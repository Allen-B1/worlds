package main

import (
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
	Data       interface{}
	Transition map[string]int
	sync.Mutex
}

// rooms and games
var objects sync.Map

func gameThread() {
	for {
		turnTimer := time.After(1000 * time.Millisecond)
		fmt.Println("next turn")
		objects.Range(func(key, value interface{}) bool {
			obj := value.(*Object)
			obj.Lock()
			if game, ok := obj.Data.(*Game); ok {
				game.NextTurn()

				if len(game.Losers) == len(game.Players) {
					objects.Delete(key)
				}
			}
			obj.Unlock()
			return true
		})
		<-turnTimer
	}
}

func main() {
	go gameThread()

	rand.Seed(time.Now().UnixNano())

	m := mux.NewRouter()
	http.Handle("/", m)

	m.HandleFunc("/api/new", func(w http.ResponseWriter, r *http.Request) {
		max, _ := strconv.Atoi(r.FormValue("max"))
		if max == 0 {
			max = 4
		}

		id := strconv.FormatUint(rand.Uint64(), 36)
		obj := new(Object)
		obj.Data = NewRoom(max)
		objects.Store(id, obj)

		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, id)
	}).Methods("POST")

	m.HandleFunc("/api/{object}/data.json", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["object"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		body, err := json.Marshal(obj.Data)
		obj.Unlock()

		if err != nil {
			return
			w.WriteHeader(500)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}).Methods("GET")

	m.HandleFunc("/api/{object}/leave", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["object"])
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

			if item.Full() {
				arr, keymap := item.PlayersAsArray()
				obj.Transition = keymap
				obj.Data = NewGame(arr)
			}
		case *Game:
			key := r.FormValue("key")
			output = fmt.Sprint(obj.Transition[key])
		}
		obj.Unlock()

		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, output)
	}).Methods("POST")

	m.HandleFunc("/api/{game}/move", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["game"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		defer obj.Unlock()
		game, ok := obj.Data.(*Game)
		if !ok {
			w.WriteHeader(404)
			return
		}

		key := r.FormValue("key")
		from, err1 := strconv.Atoi(r.FormValue("from"))
		to, err2 := strconv.Atoi(r.FormValue("to"))
		if err1 != nil || err2 != nil {
			w.WriteHeader(400)
			return
		}

		index, ok := obj.Transition[key]
		if !ok {
			w.WriteHeader(400)
			fmt.Fprintln(w, "invalid key")
		}

		err := game.Move(index, from, to)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintln(w, err)
		}
	}).Methods("POST")

	m.HandleFunc("/api/{game}/make", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["game"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		defer obj.Unlock()
		game, ok := obj.Data.(*Game)
		if !ok {
			w.WriteHeader(404)
			return
		}

		key := r.FormValue("key")
		tileType := TileType(r.FormValue("type"))
		tile, err := strconv.Atoi(r.FormValue("tile"))
		if err != nil {
			w.WriteHeader(400)
			return
		}

		index, ok := obj.Transition[key]
		if !ok {
			w.WriteHeader(400)
			fmt.Fprintln(w, "invalid key")
		}

		err = game.Make(index, tile, tileType)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintln(w, err)
		}
	}).Methods("POST")

	m.HandleFunc("/api/{game}/launch", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["game"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		defer obj.Unlock()
		game, ok := obj.Data.(*Game)
		if !ok {
			w.WriteHeader(404)
			return
		}

		key := r.FormValue("key")
		tile, err := strconv.Atoi(r.FormValue("tile"))
		if err != nil {
			w.WriteHeader(400)
			return
		}

		index, ok := obj.Transition[key]
		if !ok {
			w.WriteHeader(400)
			fmt.Fprintln(w, "invalid key")
		}

		err = game.Launch(index, tile)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintln(w, err)
		}
	}).Methods("POST")

	m.HandleFunc("/api/{game}/nuke", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		raw, _ := objects.Load(vars["game"])
		if raw == nil {
			w.WriteHeader(404)
			return
		}

		obj := raw.(*Object)
		obj.Lock()
		defer obj.Unlock()
		game, ok := obj.Data.(*Game)
		if !ok {
			w.WriteHeader(404)
			return
		}

		key := r.FormValue("key")
		tile, err := strconv.Atoi(r.FormValue("tile"))
		if err != nil {
			w.WriteHeader(400)
			return
		}

		index, ok := obj.Transition[key]
		if !ok {
			w.WriteHeader(400)
			fmt.Fprintln(w, "invalid key")
		}

		err = game.Nuke(index, tile)
		if err != nil {
			w.WriteHeader(400)
			fmt.Fprintln(w, err)
		}
	}).Methods("POST")

	m.HandleFunc("/api/tileinfo", func(w http.ResponseWriter, r *http.Request) {
		tileType := TileType(r.FormValue("type"))
		body, err := json.Marshal(TileInfos[tileType])
		if err != nil {
			w.WriteHeader(500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}).Methods("GET")

	m.HandleFunc("/{object}/game", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/game.html")
	}).Methods("GET")
	m.HandleFunc("/{object}/room", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/room.html")
	}).Methods("GET")
	m.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "files/index.html")
	}).Methods("GET")

	files := []string{"style.css", "iron.svg", "copper.svg", "gold.svg", "core.svg", "camp.svg", "mine1.svg", "mine2.svg", "mine3.svg", "kiln.svg", "brick-wall.svg", "copper-wall.svg", "iron-wall.svg", "launcher.svg", "cleaner.svg", "ocean.svg", "uranium.svg", "earth.ogg", "mars.ogg", "game.js", "game.css"}
	for _, file := range files {
		file2 := file
		m.HandleFunc("/"+file2, func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, "files/"+file2)
		}).Methods("GET")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	http.ListenAndServe(":"+port, nil)
}
