package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
)

type Relationship int

const (
	Enemies Relationship = -1
	Neutral Relationship = 0
	Cordial Relationship = 1
	Allies  Relationship = 2
)

type PlayerStat struct {
	Materials map[Material]uint `json:"materials"`
}

type Game struct {
	Armies    []uint32
	Territory []int
	Terrain   []Terrain
	TileTypes []TileType
	Deposits  []Material

	Players []string
	Stats   []PlayerStat
	Losers  []int

	Relationships map[[2]int]Relationship
	Requests      map[[2]int]int

	Turn      uint
	Pollution uint

	Fog bool
}

// spectator
func (g *Game) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"armies":    g.Armies,
		"territory": g.Territory,
		"tiletypes": g.TileTypes,
		"deposits":  g.Deposits,
		"terrain":   g.Terrain,
		"players":   g.Players,
		"losers":    g.Losers,
		"stats":     g.Stats,
		"turn":      g.Turn,
		"pollution": g.Pollution,

		"type": "game",
	})
}

func (g *Game) MarshalFor(player int) ([]byte, error) {
	armies := g.Armies
	territory := g.Territory
	tiletypes := g.TileTypes
	deposits := g.Deposits
	terrain := g.Terrain
	relationships := make([]Relationship, len(g.Players))
	if g.Fog {
		armies = make([]uint32, len(g.Armies))
		territory = make([]int, len(g.Territory))
		tiletypes = make([]TileType, len(g.TileTypes))
		deposits = make([]Material, len(g.Deposits))
		terrain = make([]Terrain, len(g.Terrain))

		for tile, _ := range territory {
			territory[tile] = -1
			terrain[tile] = Fog
		}

		for tile, terr := range g.Territory {
			if terr == player || g.Relationships[g.association(terr, player)] == Allies {
				planet, x, y := tileToCoord(tile)
				tiles := []int{
					tile,
					tileFromCoord(planet, x-1, y+1),
					tileFromCoord(planet, x-1, y),
					tileFromCoord(planet, x-1, y-1),
					tileFromCoord(planet, x, y+1),
					tileFromCoord(planet, x, y-1),
					tileFromCoord(planet, x+1, y+1),
					tileFromCoord(planet, x+1, y),
					tileFromCoord(planet, x+1, y-1),
				}
				for _, knownTile := range tiles {
					if knownTile != -1 {
						territory[knownTile] = g.Territory[knownTile]
						armies[knownTile] = g.Armies[knownTile]
						tiletypes[knownTile] = g.TileTypes[knownTile]
						terrain[knownTile] = g.Terrain[knownTile]
						deposits[knownTile] = g.Deposits[knownTile]
					}
				}
			}
		}
	}

	for player2, _ := range relationships {
		relationships[player2] = g.Relationships[g.association(player, player2)]
	}

	return json.Marshal(map[string]interface{}{
		"armies":    armies,
		"territory": territory,
		"tiletypes": tiletypes,
		"deposits":  deposits,
		"terrain":   terrain,
		"players":   g.Players,
		"losers":    g.Losers,
		"stats":     g.Stats,
		"turn":      g.Turn,
		"pollution": g.Pollution,

		"relationships": relationships,

		"type": "game",
	})
}

func (g *Game) NextTurn() {
	cleaning := uint(0)
	for tile, tileType := range g.TileTypes {
		if planet, _, _ := tileToCoord(tile); planet == Earth {
			g.Pollution += TileInfos[tileType].Pollution
		}

		if g.Terrain[tile] == Ocean && g.TileTypes[tile] != Bridge && g.Armies[tile] != 0 {
			g.Armies[tile] -= 1
			if g.Armies[tile] == 0 {
				g.Territory[tile] = -1
			}
		}

		switch tileType {
		case Camp:
			if g.Turn%5 == 0 {
				if g.Stats[g.Territory[tile]].Materials[Brick] >= 2 {
					g.Stats[g.Territory[tile]].Materials[Brick] -= 2
					g.Armies[tile] += 1
				}
			}
		case Kiln:
			player := g.Territory[tile]
			if player < 0 {
				break
			}
			g.Stats[player].Materials[Brick] += 1
		case MineV1, MineV2, MineV3:
			player := g.Territory[tile]
			if player < 0 {
				break
			}
			material := g.Deposits[tile]
			g.Stats[player].Materials[material] += 1
		case Cleaner:
			if planet, _, _ := tileToCoord(tile); planet == Earth {
				cleaning += 1
			}
		}
	}
	if g.Pollution >= cleaning {
		g.Pollution -= cleaning
	} else {
		g.Pollution = 0
	}

	// death from pollution
	if g.Pollution >= 50000 {
		for i := 0; i < EarthSize*EarthSize; i++ {
			if g.Territory[i] >= 0 {
				g.TileTypes[i] = ""
				g.Armies[i] = 0
				g.Territory[i] = -1
			}
		}
		for player, _ := range g.Players {
			g.checkLoser(player, -1)
		}
	}

	g.Turn++
}

func (g *Game) association(player1 int, player2 int) [2]int {
	larger := player2
	smaller := player1
	if player1 > player2 {
		larger = player1
		smaller = player2
	}
	return [2]int{smaller, larger}
}

func (g *Game) DowngradeRelationship(player1 int, player2 int) {
	assoc := g.association(player1, player2)
	if g.Relationships[assoc] >= 0 {
		g.Relationships[assoc] -= 1
		g.Requests[assoc] = -1

		if g.Relationships[assoc] == Enemies {
			for assoc, status := range g.Relationships {
				if status >= Cordial {
					otherPlayer := -1
					if assoc[0] == player2 {
						otherPlayer = assoc[1]
					} else if assoc[1] == player2 {
						otherPlayer = assoc[0]
					} else {
						continue
					}

					otherAssoc := g.association(player1, otherPlayer)
					if g.Relationships[otherAssoc] == Neutral {
						g.Relationships[otherAssoc] = Enemies
					}
					if g.Relationships[otherAssoc] > Neutral {
						g.Relationships[otherAssoc] = Neutral
					}
				}
			}
		}
	}
}

func (g *Game) UpgradeRelationship(player1 int, player2 int) {
	assoc := g.association(player1, player2)
	if g.Requests[assoc] == player2 {
		if g.Relationships[assoc] < Allies {
			g.Relationships[assoc] += 1
		}
		g.Requests[assoc] = -1
	} else {
		g.Requests[assoc] = player1
	}
}

// Checks whether this player should lose
func (g *Game) checkLoser(player int, winner int) {
	if player < 0 {
		return
	}

	hasCore := false
	for tile, tileType := range g.TileTypes {
		if tileType == Core && g.Territory[tile] == player {
			hasCore = true
		}
	}
	if !hasCore {
		g.Losers = append(g.Losers, player)
		for tile, territory := range g.Territory {
			if territory == player {
				g.Territory[tile] = winner
				if winner == -1 {
					g.Armies[tile] = 0
				}
			}
		}
	}
}

func (g *Game) Make(player int, tile int, tileType TileType) error {
	if g.Territory[tile] != player {
		return errors.New("you must own a territory to build on it")
	}

	if tileType == "" {
		oldType := g.TileTypes[tile]
		g.TileTypes[tile] = ""

		if oldType == Core {
			g.checkLoser(player, -1)
		}
		return nil
	}

	if g.TileTypes[tile] != "" || (g.Terrain[tile] == Ocean && tileType != Bridge) {
		return errors.New("tile " + fmt.Sprint(tile) + " is not empty")
	}

	if tileType == Bridge && g.Terrain[tile] != Ocean {
		return errors.New("bridges must be built in the ocean")
	}

	for material, cost := range TileInfos[tileType].Cost {
		if g.Stats[player].Materials[material] < cost {
			return errors.New("insufficient material: " + string(material))
		}
	}

	if tileType == MineV1 && g.Deposits[tile] != Copper {
		return errors.New("mine v1 can only mine copper")
	}
	if tileType == MineV2 && g.Deposits[tile] != Copper && g.Deposits[tile] != Iron && g.Deposits[tile] != Uranium && g.Deposits[tile] != Green {
		return errors.New("mine v2 can only mine copper, iron, and uranium")
	}
	if tileType == MineV3 && g.Deposits[tile] != Gold {
		return errors.New("mine v3 can only mine gold")
	}

	if tileType == Camp || tileType == Kiln {
		planet, x, y := tileToCoord(tile)
		tiles := []int{
			tileFromCoord(planet, x-1, y+1),
			tileFromCoord(planet, x-1, y),
			tileFromCoord(planet, x-1, y-1),
			tileFromCoord(planet, x, y+1),
			tileFromCoord(planet, x, y-1),
			tileFromCoord(planet, x+1, y+1),
			tileFromCoord(planet, x+1, y),
			tileFromCoord(planet, x+1, y-1),
		}

		adj := false
		for _, tile := range tiles {
			if tile > 0 && g.TileTypes[tile] == Core {
				adj = true
			}
		}
		if !adj {
			return errors.New("camp and kiln must be inside village")
		}
	}

	if tileType == Core {
		planet, x, y := tileToCoord(tile)
		tiles := []int{
			tileFromCoord(planet, x-1, y+1),
			tileFromCoord(planet, x-1, y),
			tileFromCoord(planet, x-1, y-1),
			tileFromCoord(planet, x, y+1),
			tileFromCoord(planet, x, y-1),
			tileFromCoord(planet, x+1, y+1),
			tileFromCoord(planet, x+1, y),
			tileFromCoord(planet, x+1, y-1),
		}

		for _, tile := range tiles {
			if g.Territory[tile] == -1 && g.Armies[tile] == 0 && g.Terrain[tile] == Land {
				g.Territory[tile] = player
				g.Armies[tile] = 1
			}
		}
	}

	if tileType == CopperWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 500
	}
	if tileType == IronWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 2000
	}

	for material, cost := range TileInfos[tileType].Cost {
		g.Stats[player].Materials[material] -= cost
	}
	g.TileTypes[tile] = tileType

	return nil
}

func (g *Game) Move(player int, from int, to int) error {
	if g.Territory[from] != player ||
		g.Armies[from] < 1 ||
		to >= len(g.Territory) || to < 0 {
		return nil
	}

	if from == to {
		return nil
	}

	fromPlanet, fromX, fromY := tileToCoord(from)
	toPlanet, toX, toY := tileToCoord(to)

	if fromPlanet != toPlanet {
		return errors.New("can't teleport to different planet")
	}

	if !((fromX == toX && (fromY-toY == 1 || toY-fromY == 1)) ||
		(fromY == toY && (fromX-toX == 1 || toX-fromX == 1))) {
		return fmt.Errorf("can't teleport from (%v, %v) to (%v, %v)", fromX, fromY, toX, toY)
	}

	fromArmies := g.Armies[from] - 1
	toArmies := g.Armies[to]

	assoc := g.association(player, g.Territory[to])
	if player == g.Territory[to] || g.Relationships[assoc] == Allies {
		g.Armies[from] -= fromArmies
		g.Armies[to] += fromArmies

		if g.TileTypes[to] == "" || g.TileTypes[to] == Bridge {
			g.Territory[to] = player
		}
	} else if g.Relationships[assoc] == Enemies || g.Territory[to] == -1 {
		g.Armies[from] -= fromArmies
		if fromArmies > toArmies {
			toType := g.TileTypes[to]
			toPlayer := g.Territory[to]

			if g.Territory[to] != -1 {
				g.TileTypes[to] = ""
			}
			g.Armies[to] = fromArmies - toArmies
			g.Territory[to] = player

			// Lose if no cores left
			if toType == Core {
				g.checkLoser(toPlayer, player)
			}
		} else {
			g.Armies[to] -= fromArmies
		}
	} else {
		return fmt.Errorf("can't attack neutral or cordial player")
	}

	return nil
}

func NewGame(m *Map, players []string, fog bool) *Game {
	g := new(Game)
	g.Fog = fog

	g.Pollution = 10000

	g.Armies = make([]uint32, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Territory = make([]int, EarthSize*EarthSize+MarsSize*MarsSize)
	g.TileTypes = append([]TileType(nil), m.Walls...)
	g.Deposits = append([]Material(nil), m.Deposits...)
	g.Terrain = append([]Terrain(nil), m.Terrain...)

	g.Relationships = make(map[[2]int]Relationship)
	g.Requests = make(map[[2]int]int)

	g.Players = players
	g.Stats = make([]PlayerStat, len(players))
	for player, _ := range g.Stats {
		g.Stats[player].Materials = make(map[Material]uint)
	}

	for tile, _ := range g.Territory {
		g.Territory[tile] = -1
	}

	// Cores
	for i := 0; i < len(players); i++ {
		_, x, y := tileToCoord(m.Spawns[i])
		tile := tileFromCoord(Earth, x, y)
		kilnTile := tileFromCoord(Earth, x+1, y)

		tiles := []int{
			tile,
			kilnTile,
			tileFromCoord(Earth, x, y+1),
			tileFromCoord(Earth, x+1, y+1),
			tileFromCoord(Earth, x-1, y),
			tileFromCoord(Earth, x, y-1),
			tileFromCoord(Earth, x-1, y-1),
			tileFromCoord(Earth, x-1, y+1),
			tileFromCoord(Earth, x+1, y-1),
		}

		for _, tile := range tiles {
			g.Territory[tile] = i
			g.Armies[tile] = 1
			g.TileTypes[tile] = ""
			g.Terrain[tile] = Land
		}
		g.Armies[tile] = 15
		g.TileTypes[tile] = Core
		g.TileTypes[kilnTile] = Kiln
	}

	return g
}

func (g *Game) Launch(player int, tile int) error {
	if g.TileTypes[tile] != Launcher || g.Territory[tile] != player {
		return errors.New("launcher required to launch")
	}

	core := -1
	for i := EarthSize * EarthSize; i < len(g.TileTypes); i++ {
		if g.TileTypes[i] == Core && g.Territory[i] == player {
			core = i
		}
	}

	if core == -1 {
		x := uint(rand.Intn(MarsSize-2) + 1)
		y := uint(rand.Intn(MarsSize-2) + 1)

		tiles := []int{
			tileFromCoord(Mars, x, y),
			tileFromCoord(Mars, x+1, y),
			tileFromCoord(Mars, x, y+1),
			tileFromCoord(Mars, x+1, y+1),
			tileFromCoord(Mars, x-1, y),
			tileFromCoord(Mars, x, y-1),
			tileFromCoord(Mars, x-1, y-1),
			tileFromCoord(Mars, x-1, y+1),
			tileFromCoord(Mars, x+1, y-1),
		}

		for _, tile := range tiles {
			g.Territory[tile] = player
			g.Armies[tile] = 1
			g.TileTypes[tile] = ""
		}

		core = tiles[0]
		g.TileTypes[core] = Core
	}
	transfer := g.Armies[tile] - 1
	g.Armies[core] += transfer
	g.Armies[tile] -= transfer
	return nil
}

func (g *Game) Nuke(player int, tile int) error {
	cost := map[Material]uint{
		Uranium: 1000,
		Iron:    1000,
	}

	for material, amt := range cost {
		if g.Stats[player].Materials[material] < amt {
			return errors.New("not enough " + string(material) + ": " + fmt.Sprint(amt) + " required")
		}
	}

	for material, amt := range cost {
		g.Stats[player].Materials[material] -= amt
	}

	planet, x, y := tileToCoord(tile)

	for nX := x - 2; nX <= x+2; nX++ {
		for nY := y - 2; nY <= y+2; nY++ {
			nTile := tileFromCoord(planet, nX, nY)
			if nTile >= 0 {
				if g.TileTypes[nTile] == CopperWall || g.TileTypes[nTile] == IronWall {
					damage := map[TileType]uint32{
						CopperWall: 30,
						IronWall:   20,
					}[g.TileTypes[nTile]]

					if g.Armies[nTile] > damage {
						g.Armies[nTile] -= damage
					} else {
						g.Armies[nTile] = 0
						g.TileTypes[nTile] = ""
					}
				} else if g.Armies[nTile] > 30 {
					g.Armies[nTile] /= 2
				} else if g.Armies[nTile] > 15 {
					g.Armies[nTile] -= 15
				} else {
					g.Armies[nTile] = 0
					g.TileTypes[nTile] = ""
					g.Territory[nTile] = -1

					g.checkLoser(g.Territory[nTile], -1)
				}
			}
		}
	}

	if planet == Earth {
		g.Pollution += 5000
	}

	return nil
}
