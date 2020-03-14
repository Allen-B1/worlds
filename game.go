package main

import (
	"errors"
	"fmt"
	"math/rand"
)

type Planet string

const (
	Mars  Planet = "mars"
	Earth Planet = "earth"

	MarsSize  = 16 // 16*16
	EarthSize = 24 // 24*24
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
	Name      string
	Pollution uint
	Cost      map[Material]uint
}

var TileInfos = map[TileType]TileInfo{
	Core: TileInfo{
		Name: "Core",
		Cost: map[Material]uint{
			Brick:  200,
			Copper: 100,
			Iron:   50,
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
			Brick: 50,
		},
		Pollution: 1,
	},
	MineV1: TileInfo{
		Name: "Mine v1",
		Cost: map[Material]uint{
			Brick: 50,
		},
		Pollution: 1,
	},
	MineV2: TileInfo{
		Name: "Mine v2",
		Cost: map[Material]uint{
			Brick:  50,
			Copper: 50,
		},
	},
	MineV3: TileInfo{
		Name: "Mine v3",
		Cost: map[Material]uint{
			Brick:  50,
			Copper: 50,
			Iron:   20,
		},
	},
	BrickWall: TileInfo{
		Name: "Brick Wall",
		Cost: map[Material]uint{
			Brick: 1,
		},
	},
	CopperWall: TileInfo{
		Name: "Copper Wall",
		Cost: map[Material]uint{
			Copper: 1,
		},
	},
	IronWall: TileInfo{
		Name: "Iron Wall",
		Cost: map[Material]uint{
			Iron: 1,
		},
	},
	Launcher: TileInfo{
		Name: "Launcher",
		Cost: map[Material]uint{
			Brick:  500,
			Copper: 200,
			Iron:   10,
			Gold:   50,
		},
	},
	Cleaner: TileInfo{
		Name: "Cleaner",
		Cost: map[Material]uint{
			Copper:  500,
			Iron:    500,
			Uranium: 20,
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
	Armies    []uint32   `json:"armies"`
	Territory []int      `json:"territory"`
	TileTypes []TileType `json:"tiletypes"`
	Deposits  []Material `json:"deposits"`

	Players []string     `json:"players"`
	Stats   []PlayerStat `json:"stats"`

	Turn uint `json:"turn"`

	Pollution uint `json:"pollution"`
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
			g.Armies[tile] += 1
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
			cleaning += 1
		}
	}
	if g.Pollution >= cleaning {
		g.Pollution -= cleaning
	}
	g.Turn++
}

func (g *Game) Make(player int, tile int, tileType TileType) error {
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

	if tileType == BrickWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 500
	}
	if tileType == CopperWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 2000
	}
	if tileType == IronWall {
		g.Territory[tile] = -1
		g.Armies[tile] = 10000
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

	if !((fromX == fromY && (toX-toY == 1 || toY-toX == 1)) ||
		(toX == toY && (fromX-fromY == 1 || fromY-fromX == 1))) {
		return errors.New("can't teleport")
	}

	fromArmies := g.Armies[from] - 1
	toArmies := g.Armies[to]

	g.Armies[from] -= fromArmies
	if fromArmies > toArmies {
		g.Armies[to] = fromArmies - toArmies
		g.Territory[to] = player
		g.TileTypes[to] = ""

		// TODO: Lose if no cores left
	} else {
		g.Armies[to] -= fromArmies
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
		x := uint(rand.Intn(EarthSize-12)) + 6
		y := uint(rand.Intn(EarthSize-12)) + 6
		tile1 := g.tileFromCoord(Earth, x, y)
		tile2 := g.tileFromCoord(Earth, x+1, y)
		tile3 := g.tileFromCoord(Earth, x, y+1)
		tile4 := g.tileFromCoord(Earth, x+1, y+1)

		g.Deposits[tile1] = Copper
		g.Deposits[tile2] = Copper
		g.Deposits[tile3] = Copper
		g.Deposits[tile4] = Copper
	}

	for i := 0; i < 8; i++ {
		x := uint(rand.Intn(EarthSize-12)) + 6
		y := uint(rand.Intn(EarthSize-12)) + 6
		tile1 := g.tileFromCoord(Earth, x, y)
		tile2 := g.tileFromCoord(Earth, x+1, y)
		tile3 := g.tileFromCoord(Earth, x, y+1)
		tile4 := g.tileFromCoord(Earth, x+1, y+1)

		g.Deposits[tile1] = Iron
		g.Deposits[tile2] = Iron
		g.Deposits[tile3] = Iron
		g.Deposits[tile4] = Iron
	}

	for i := 0; i < 3; i++ {
		x := uint(rand.Intn(EarthSize-12)) + 6
		y := uint(rand.Intn(EarthSize-12)) + 6
		tile1 := g.tileFromCoord(Earth, x, y)
		tile2 := g.tileFromCoord(Earth, x+1, y)
		tile3 := g.tileFromCoord(Earth, x, y+1)
		tile4 := g.tileFromCoord(Earth, x+1, y+1)

		g.Deposits[tile1] = Gold
		g.Deposits[tile2] = Gold
		g.Deposits[tile3] = Gold
		g.Deposits[tile4] = Gold
	}

	for i := 0; i < 6; i++ {
		x := uint(rand.Intn(MarsSize-12)) + 6
		y := uint(rand.Intn(MarsSize-12)) + 6
		tile1 := g.tileFromCoord(Mars, x, y)
		tile2 := g.tileFromCoord(Mars, x+1, y)
		tile3 := g.tileFromCoord(Mars, x, y+1)
		tile4 := g.tileFromCoord(Mars, x+1, y+1)

		g.Deposits[tile1] = Uranium
		g.Deposits[tile2] = Uranium
		g.Deposits[tile3] = Uranium
		g.Deposits[tile4] = Uranium
	}

	for i := 0; i < len(players); i++ {
		x := uint(rand.Intn(EarthSize-12)) + 6
		y := uint(rand.Intn(EarthSize-12)) + 6
		tile := g.tileFromCoord(Earth, x, y)

		tiles := []int{
			tile,
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
			g.Territory[tile] = i
			g.Armies[tile] = 1
		}
		g.Armies[tile] = 42
		g.TileTypes[tile] = Core
	}

	return g
}

func (g *Game) DropNuclear(player int) error {
	return errors.New("insufficient implementation")
}
