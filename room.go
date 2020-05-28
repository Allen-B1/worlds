package main

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	mrand "math/rand"
	"strconv"
)

type Room struct {
	Max     int
	Players map[string]string
	Fog     bool
}

func (r *Room) MarshalJSON() ([]byte, error) {
	players, _ := r.PlayersAsArray()
	return json.Marshal(map[string]interface{}{
		"type":    "room",
		"max":     r.Max,
		"fog":     r.Fog,
		"players": players,
	})
}

func (r *Room) Leave(key string) {
	delete(r.Players, key)
}

func (r *Room) Join(name string) string {
	num, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		num = big.NewInt(mrand.Int63())
	}
	key := strconv.FormatUint(num.Uint64(), 36)
	r.Players[key] = name
	return key
}

func (r *Room) Full() bool {
	return len(r.Players) >= r.Max
}

func (r *Room) PlayersAsArray() ([]string, map[string]int) {
	m := make(map[string]int)
	a := make([]string, 0, len(r.Players))
	for key, player := range r.Players {
		i := len(a)
		a = append(a, player)
		m[key] = i
	}
	return a, m
}

func NewRoom(max int, fog bool) *Room {
	return &Room{
		Max:     max,
		Players: make(map[string]string),
		Fog:     fog,
	}
}
