package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
)

type Planet string

const (
	Mars  Planet = "mars"
	Earth Planet = "earth"

	MarsSize  = 24 // 24*24
	EarthSize = 40 // 40*40
)

type TileType string

const (
	Core TileType = "core"
	Camp TileType = "camp"

	Kiln   TileType = "kiln"
	MineV1 TileType = "mine1"
	MineV2 TileType = "mine2"
	MineV3 TileType = "mine3"

	BrickWall  TileType = "brick-wall"
	IronWall   TileType = "iron-wall"
	CopperWall TileType = "copper-wall"

	Launcher TileType = "launcher"
	Cleaner  TileType = "cleaner"
)

type TileInfo struct {
	Name      string            `json:"name"`
	Pollution uint              `json:"pollution"`
	Cost      map[Material]uint `json:"cost"`
}

var TileInfos = map[TileType]TileInfo{
	Core: TileInfo{
		Name: "Core",
		Cost: map[Material]uint{
			Brick:  200,
			Copper: 500,
			Iron:   500,
			Gold:   20,
		},
	},
	Camp: TileInfo{
		Name: "Camp",
		Cost: map[Material]uint{
			Brick: 50,
		},
	},
	Kiln: TileInfo{
		Name: "Kiln",
		Cost: map[Material]uint{
			Brick: 20,
		},
		Pollution: 1,
	},
	MineV1: TileInfo{
		Name: "Mine v1",
		Cost: map[Material]uint{
			Brick: 100,
		},
		Pollution: 1,
	},
	MineV2: TileInfo{
		Name: "Mine v2",
		Cost: map[Material]uint{
			Copper: 200,
		},
	},
	MineV3: TileInfo{
		Name: "Mine v3",
		Cost: map[Material]uint{
			Copper: 200,
			Iron:   200,
		},
	},
	BrickWall: TileInfo{
		Name: "Brick Wall",
		Cost: map[Material]uint{
			Brick: 10,
		},
	},
	CopperWall: TileInfo{
		Name: "Copper Wall",
		Cost: map[Material]uint{
			Copper: 10,
		},
	},
	IronWall: TileInfo{
		Name: "Iron Wall",
		Cost: map[Material]uint{
			Iron: 10,
		},
	},
	Launcher: TileInfo{
		Name: "Launcher",
		Cost: map[Material]uint{
			Brick:  500,
			Copper: 1000,
			Iron:   800,
			Gold:   200,
		},
	},
	Cleaner: TileInfo{
		Name: "Cleaner",
		Cost: map[Material]uint{
			Iron:    50,
			Uranium: 50,
		},
	},
}

type Material string

const (
	Brick   Material = "brick"
	Copper  Material = "copper"
	Iron    Material = "iron"
	Gold    Material = "gold"
	Uranium Material = "uranium"
)

type PlayerStat struct {
	Materials map[Material]uint `json:"materials"`
}

type Game struct {
	Armies    []uint32
	Territory []int
	TileTypes []TileType
	Deposits  []Material

	Players []string
	Stats   []PlayerStat
	Losers  []int

	Turn uint

	Pollution uint
}

func (g *Game) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"armies":    g.Armies,
		"territory": g.Territory,
		"tiletypes": g.TileTypes,
		"deposits":  g.Deposits,
		"players":   g.Players,
		"losers":    g.Losers,
		"stats":     g.Stats,
		"turn":      g.Turn,
		"pollution": g.Pollution,

		"type": "game",
	})
}

func (g *Game) tileToCoord(id int) (planet Planet, x uint, y uint) {
	if id >= EarthSize*EarthSize {
		id -= EarthSize * EarthSize
		return Mars, uint(id % MarsSize), uint(id / MarsSize)
	} else {
		return Earth, uint(id % EarthSize), uint(id / EarthSize)
	}
}

func (g *Game) tileFromCoord(planet Planet, x uint, y uint) int {
	if planet == Mars {
		if x >= MarsSize || y >= MarsSize {
			return -1
		}
		return int(EarthSize*EarthSize + y*MarsSize + x)
	} else {
		if x >= EarthSize || y >= EarthSize {
			return -1
		}
		return int(y*EarthSize + x)
	}
}

func (g *Game) NextTurn() {
	cleaning := uint(0)
	for tile, tileType := range g.TileTypes {
		if planet, _, _ := g.tileToCoord(tile); planet == Earth {
			g.Pollution += TileInfos[tileType].Pollution
		}

		switch tileType {
		case Camp:
			if g.Turn%5 == 0 {
				g.Armies[tile] += 1
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
			if planet, _, _ := g.tileToCoord(tile); planet == Earth {
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
	if g.Pollution >= 1000*1000 {
		for i := 0; i < EarthSize*EarthSize; i++ {
			if g.Territory[i] >= 0 {
				g.TileTypes[i] = ""
				g.Armies[i] = 0
				g.Territory[i] = -1
			}
		}
		for player, _ := range g.Players {
			g.checkLoser(player)
		}
	}

	g.Turn++
}

// Checks whether this player should lose
func (g *Game) checkLoser(player int) {
	hasCore := false
	for tile, tileType := range g.TileTypes {
		if tileType == Core && g.Territory[tile] == player {
			hasCore = true
		}
	}
	if !hasCore {
		g.Losers = append(g.Losers, player)
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
			g.checkLoser(player)
		}
		return nil
	}

	if g.TileTypes[tile] != "" {
		return errors.New("tile " + fmt.Sprint(tile) + " is not empty")
	}

	for material, cost := range TileInfos[tileType].Cost {
		if g.Stats[player].Materials[material] < cost {
			return errors.New("insufficient material: " + string(material))
		}
	}

	if tileType == MineV1 && g.Deposits[tile] != Copper {
		return errors.New("mine v1 can only mine copper")
	}
	if tileType == MineV2 && g.Deposits[tile] != Copper && g.Deposits[tile] != Iron && g.Deposits[tile] != Uranium {
		return errors.New("mine v2 can only mine copper, iron, and uranium")
	}
	if tileType == MineV3 && g.Deposits[tile] != Gold {
		return errors.New("mine v3 can only mine gold")
	}

	if tileType == Camp || tileType == Kiln {
		planet, x, y := g.tileToCoord(tile)
		tiles := []int{
			g.tileFromCoord(planet, x-1, y+1),
			g.tileFromCoord(planet, x-1, y),
			g.tileFromCoord(planet, x-1, y-1),
			g.tileFromCoord(planet, x, y+1),
			g.tileFromCoord(planet, x, y-1),
			g.tileFromCoord(planet, x+1, y+1),
			g.tileFromCoord(planet, x+1, y),
			g.tileFromCoord(planet, x+1, y-1),
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
		planet, x, y := g.tileToCoord(tile)
		tiles := []int{
			g.tileFromCoord(planet, x-1, y+1),
			g.tileFromCoord(planet, x-1, y),
			g.tileFromCoord(planet, x-1, y-1),
			g.tileFromCoord(planet, x, y+1),
			g.tileFromCoord(planet, x, y-1),
			g.tileFromCoord(planet, x+1, y+1),
			g.tileFromCoord(planet, x+1, y),
			g.tileFromCoord(planet, x+1, y-1),
		}

		for _, tile := range tiles {
			if g.Territory[tile] == -1 && g.Armies[tile] == 0 {
				g.Territory[tile] = player
			}
		}
	}

	if tileType == BrickWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 200
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
		g.Armies[from] < 2 ||
		to >= len(g.Territory) || to < 0 {
		return nil
	}

	if from == to {
		return nil
	}

	fromPlanet, fromX, fromY := g.tileToCoord(from)
	toPlanet, toX, toY := g.tileToCoord(to)

	if fromPlanet != toPlanet {
		return errors.New("can't teleport to different planet")
	}

	if !((fromX == toX && (fromY-toY == 1 || toY-fromY == 1)) ||
		(fromY == toY && (fromX-toX == 1 || toX-fromX == 1))) {
		return fmt.Errorf("can't teleport from (%v, %v) to (%v, %v)", fromX, fromY, toX, toY)
	}

	fromArmies := g.Armies[from] - 1
	toArmies := g.Armies[to]

	g.Armies[from] -= fromArmies
	if player == g.Territory[to] {
		g.Armies[to] += fromArmies
	} else {
		if fromArmies > toArmies {
			toType := g.TileTypes[to]
			toPlayer := g.Territory[to]

			g.Armies[to] = fromArmies - toArmies
			g.Territory[to] = player
			g.TileTypes[to] = ""

			// Lose if no cores left
			if toType == Core {
				g.checkLoser(toPlayer)
			}
		} else {
			g.Armies[to] -= fromArmies
		}
	}

	return nil
}

func NewGame(players []string) *Game {
	g := new(Game)
	g.Armies = make([]uint32, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Territory = make([]int, EarthSize*EarthSize+MarsSize*MarsSize)
	g.TileTypes = make([]TileType, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Deposits = make([]Material, EarthSize*EarthSize+MarsSize*MarsSize)

	g.Players = players
	g.Stats = make([]PlayerStat, len(players))
	for player, _ := range g.Stats {
		g.Stats[player].Materials = make(map[Material]uint)
	}

	for tile, _ := range g.Territory {
		g.Territory[tile] = -1
	}

	for i := 0; i < 16; i++ {
		x := uint(rand.Intn(EarthSize-2)) + 1
		y := uint(rand.Intn(EarthSize-2)) + 1
		tiles := []int{
			g.tileFromCoord(Earth, x, y),
			g.tileFromCoord(Earth, x+1, y),
			g.tileFromCoord(Earth, x, y+1),
			g.tileFromCoord(Earth, x+1, y+1),
			g.tileFromCoord(Earth, x-1, y),
			g.tileFromCoord(Earth, x, y-1),
			g.tileFromCoord(Earth, x-1, y-1),
			g.tileFromCoord(Earth, x-1, y+1),
			g.tileFromCoord(Earth, x+1, y-1),
		}

		for _, tile := range tiles {
			g.Deposits[tile] = Copper
		}
	}

	for i := 0; i < 12; i++ {
		x := uint(rand.Intn(EarthSize - 1))
		y := uint(rand.Intn(EarthSize - 1))
		tiles := []int{
			g.tileFromCoord(Earth, x, y),
			g.tileFromCoord(Earth, x+1, y),
			g.tileFromCoord(Earth, x, y+1),
			g.tileFromCoord(Earth, x+1, y+1),
		}

		for _, tile := range tiles {
			g.Deposits[tile] = Iron
		}
	}

	{
		tiles := []int{
			g.tileFromCoord(Earth, 1, 1),
			g.tileFromCoord(Earth, EarthSize-2, 1),
			g.tileFromCoord(Earth, 1, EarthSize-2),
			g.tileFromCoord(Earth, EarthSize-2, EarthSize-2),
		}

		for _, tile := range tiles {
			g.Deposits[tile] = Gold
		}
	}

	for i := 0; i < 8; i++ {
		x := uint(rand.Intn(MarsSize - 1))
		y := uint(rand.Intn(MarsSize - 1))
		tiles := []int{
			g.tileFromCoord(Mars, x, y),
			g.tileFromCoord(Mars, x+1, y),
			g.tileFromCoord(Mars, x, y+1),
			g.tileFromCoord(Mars, x+1, y+1),
		}

		for _, tile := range tiles {
			g.Deposits[tile] = Uranium
		}
	}

	for i := 0; i < len(players); i++ {
		x := uint(rand.Intn(EarthSize-4)) + 2
		y := uint(rand.Intn(EarthSize-4)) + 2
		tile := g.tileFromCoord(Earth, x, y)
		kilnTile := g.tileFromCoord(Earth, x+1, y)

		tiles := []int{
			tile,
			kilnTile,
			g.tileFromCoord(Earth, x, y+1),
			g.tileFromCoord(Earth, x+1, y+1),
			g.tileFromCoord(Earth, x-1, y),
			g.tileFromCoord(Earth, x, y-1),
			g.tileFromCoord(Earth, x-1, y-1),
			g.tileFromCoord(Earth, x-1, y+1),
			g.tileFromCoord(Earth, x+1, y-1),
		}

		for _, tile := range tiles {
			g.Territory[tile] = i
			g.Armies[tile] = 1
			g.TileTypes[tile] = ""
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

	for i := EarthSize * EarthSize; i < len(g.TileTypes); i++ {
		if g.TileTypes[i] == Core && g.Territory[i] == player {
			return nil
		}
	}

	x := uint(rand.Intn(MarsSize-2) + 1)
	y := uint(rand.Intn(MarsSize-2) + 1)

	tiles := []int{
		g.tileFromCoord(Mars, x, y),
		g.tileFromCoord(Mars, x+1, y),
		g.tileFromCoord(Mars, x, y+1),
		g.tileFromCoord(Mars, x+1, y+1),
		g.tileFromCoord(Mars, x-1, y),
		g.tileFromCoord(Mars, x, y-1),
		g.tileFromCoord(Mars, x-1, y-1),
		g.tileFromCoord(Mars, x-1, y+1),
		g.tileFromCoord(Mars, x+1, y-1),
	}

	for _, tile := range tiles {
		g.Territory[tile] = player
		g.Armies[tile] = 1
		g.TileTypes[tile] = ""
	}
	g.TileTypes[tiles[0]] = Core
	return nil
}

func (g *Game) Nuke(player int, tile int) error {
	cost := map[Material]uint{
		Uranium: 500,
		Iron:    500,
	}

	for material, amt := range cost {
		if g.Stats[player].Materials[material] < amt {
			return errors.New("not enough " + string(material))
		}
	}

	for material, amt := range cost {
		g.Stats[player].Materials[material] -= amt
	}

	planet, x, y := g.tileToCoord(tile)

	for nX := x - 2; nX <= x+2; nX++ {
		for nY := y - 2; nY <= y+2; nY++ {
			nTile := g.tileFromCoord(planet, nX, nY)
			if nTile >= 0 {
				if g.Armies[nTile] > 30 {
					g.Armies[nTile] /= 2
				} else if g.Armies[nTile] > 15 {
					g.Armies[nTile] -= 15
				} else {
					g.checkLoser(g.Territory[nTile])

					g.Armies[nTile] = 0
					g.TileTypes[nTile] = ""
					g.Territory[nTile] = -1
				}
			}
		}
	}

	if planet == Earth {
		g.Pollution += 500
	}

	return nil
}
