package main

import (
	"bitbucket.org/allenb123/arbit"
	"encoding/json"
	"fmt"
	"github.com/gorilla/mux"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type Object struct {
	Data interface{}

	// Socket  => key
	// May only contain valid keys
	Sockets  map[*arbit.Client]string
	Patchers map[*arbit.Client]*Patcher

	End *PatcherEnd

	Move []chan [3]interface{}

	// Room keys => index
	Transition map[string]int

	sync.Mutex
}

// rooms and games
var objects sync.Map

func gameThread() {
	isTurn := false
	for {
		isTurn = !isTurn

		turnTimer := time.After(500 * time.Millisecond)
		objects.Range(func(key, value interface{}) bool {
			obj := value.(*Object)
			obj.Lock()

			if game, ok := obj.Data.(*Game); ok {
				for i := 0; i < len(game.Players); i++ {
					select {
					case move := <-obj.Move[i]:
						_ = game.Move(i, move[0].(int), move[1].(int), move[2].(bool))
						fmt.Println("move")
					default:
						break
					}
				}

				if isTurn {
					game.NextTurn()
				}

				endData := (*PatcherEnd)(nil)
				for cl, patcher := range obj.Patchers {
					update := patcher.Update()
					cl.Send("update", update)
					if update.End {
						cl.Send("end", nil)
						endData = patcher.End()
					}
				}

				if endData != nil {
					obj.Data = endData
				}
			}

			if room, ok := obj.Data.(*Room); ok {
				if room.Full() {
					arr, keymap := room.PlayersAsArray()
					obj.Transition = keymap
					obj.Sockets = make(map[*arbit.Client]string)
					obj.Data = NewGame(NewRandomMap(), arr, room.Fog)
					obj.Patchers = make(map[*arbit.Client]*Patcher)
					obj.Move = make([]chan [3]interface{}, len(arr))
					for i, _ := range obj.Move {
						obj.Move[i] = make(chan [3]interface{})
					}
				}
			}
			obj.Unlock()
			//			fmt.Println("unlocked loop")
			return true
		})
		<-turnTimer
	}
}

// returns another function with executes given function
//
// assumes m["id"] is id
// also locks&unlocks the object for you :)
func playerAction(f func(cl *arbit.Client, m map[string]interface{}, obj *Object, game *Game, index int)) func(cl *arbit.Client, data interface{}) {
	return func(cl *arbit.Client, data interface{}) {
		m, ok := data.(map[string]interface{})
		if !ok {
			return
		}

		raw, _ := objects.Load(m["id"])
		obj, ok := raw.(*Object)
		if !ok {
			cl.Send("error", "invalid id")
			return
		}

		obj.Lock()
		defer obj.Unlock()

		game, ok := obj.Data.(*Game)
		if !ok {
			cl.Send("error", "invalid id")
			return
		}

		index, ok := obj.Transition[obj.Sockets[cl]]
		if !ok {
			cl.Send("error", "invalid key")
			return
		}

		f(cl, m, obj, game, index)
	}
}

func main() {
	go gameThread()

	rand.Seed(time.Now().UnixNano())

	m := mux.NewRouter()
	http.Handle("/", m)

	gamearb := arbit.NewServer()

	gamearb.On("join", func(cl *arbit.Client, data interface{}) {
		m, ok := data.(map[string]interface{})
		if !ok {
			return
		}

		raw, _ := objects.Load(m["id"])
		obj, ok := raw.(*Object)
		if !ok {
			cl.Send("error", "invalid id")
			return
		}

		obj.Lock()
		defer obj.Unlock()

		// Check game
		game, ok := obj.Data.(*Game)
		if !ok {
			cl.Send("error", "invalid id")
			return
		}

		// Check key
		key := fmt.Sprint(m["key"])
		index, ok := obj.Transition[key]
		if !ok {
			cl.Send("error", "invalid key")
			return
		}

		patcher := NewPatcher(game, index)

		obj.Sockets[cl] = key
		obj.Patchers[cl] = patcher

		cl.Send("start", patcher.Start())
	})

	gamearb.On("move", func(cl *arbit.Client, data interface{}) {
		m, ok := data.(map[string]interface{})
		if !ok {
			return
		}

		raw, _ := objects.Load(m["id"])
		obj, ok := raw.(*Object)
		if !ok {
			cl.Send("error", "invalid id")
			return
		}

		index, ok := obj.Transition[obj.Sockets[cl]]
		if !ok {
			cl.Send("error", "invalid key")
			return
		}

		// screw error handling
		// nothing wrong with wrong type = 0
		from, _ := m["from"].(float64)
		to, _ := m["to"].(float64)
		half := m["half"] == true

		obj.Move[index] <- [3]interface{}{int(from), int(to), half}
	})

	gamearb.On("make", playerAction(func(cl *arbit.Client, m map[string]interface{}, obj *Object, game *Game, index int) {
		// screw error handling, again
		tile, _ := m["tile"].(float64)
		tileType := TileType(fmt.Sprint(m["type"]))

		err := game.Make(index, int(tile), tileType)
		if err != nil {
			cl.Send("error", err.Error())
		}
	}))

	gamearb.On("launch", playerAction(func(cl *arbit.Client, m map[string]interface{}, obj *Object, game *Game, index int) {
		// screw error handling, again
		tile, _ := m["tile"].(float64)

		err := game.Launch(index, int(tile))
		if err != nil {
			cl.Send("error", err.Error())
		}
	}))

	gamearb.On("nuke", playerAction(func(cl *arbit.Client, m map[string]interface{}, obj *Object, game *Game, index int) {
		// screw error handling, again
		tile, _ := m["tile"].(float64)

		err := game.Nuke(index, int(tile))
		if err != nil {
			cl.Send("error", err.Error())
		}
	}))

	gamearb.On("relationship", playerAction(func(cl *arbit.Client, m map[string]interface{}, obj *Object, game *Game, index int) {
		// screw error handling, yet again
		player, _ := m["player"].(float64)
		upgrade := m["upgrade"] == true

		if upgrade {
			game.UpgradeRelationship(index, int(player))
		} else {
			game.DowngradeRelationship(index, int(player))
		}
	}))

	m.HandleFunc("/api/new", func(w http.ResponseWriter, r *http.Request) {
		max, _ := strconv.Atoi(r.FormValue("max"))
		if max == 0 {
			max = 4
		}

		fog := r.FormValue("fog")

		id := strconv.FormatUint(rand.Uint64(), 36)
		obj := new(Object)
		obj.Data = NewRoom(max, fog != "0")
		objects.Store(id, obj)

		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, id)
	}).Methods("POST")

	m.HandleFunc("/api/{obj}/data.json", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["obj"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		defer obj.Unlock()

		_, ok := obj.Data.(*Game)
		if ok {
			io.WriteString(w, "{\"type\":\"game\"}")
			return
		}

		body, err := json.Marshal(obj.Data)

		if err != nil {
			w.WriteHeader(500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}).Methods("GET")

	m.HandleFunc("/api/{room}/leave", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["room"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		output := ""
		obj := raw.(*Object)
		obj.Lock()
		room, ok := obj.Data.(*Room)
		if ok {
			key := r.FormValue("key")
			room.Leave(key)
		}
		obj.Unlock()

		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, output)
	}).Methods("POST")

	m.HandleFunc("/api/{object}/join", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["object"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		output := ""
		obj := raw.(*Object)
		obj.Lock()
		switch item := obj.Data.(type) {
		case *Room:
			name := r.FormValue("name")
			if name == "" {
				name = "Anonymous"
			}
			output = item.Join(name)
		case *Game:
			output = "unsupported API"
		}
		obj.Unlock()

		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, output)
	}).Methods("POST")

	m.Handle("/api/gamews", gamearb)

	m.HandleFunc("/api/tileinfo.json", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/tileinfo.json")
	}).Methods("GET")

	m.HandleFunc("/{object}/game", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/game.html")
	}).Methods("GET")
	m.HandleFunc("/{object}/room", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/room.html")
	}).Methods("GET")
	m.HandleFunc("/{object}/results", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/results.html")
	}).Methods("GET")

	m.PathPrefix("/").Handler(http.FileServer(http.Dir("files"))).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	http.ListenAndServe(":"+port, nil)
}
