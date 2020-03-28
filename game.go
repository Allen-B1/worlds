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
			Iron:   350,
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
			Iron:   1000,
			Gold:   250,
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

type Terrain string

const (
	Land  Terrain = ""
	Ocean Terrain = "ocean"
	Fog   Terrain = "fog"
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
	if !g.Fog {
		return g.MarshalJSON()
	}

	armies := make([]uint32, len(g.Armies))
	territory := make([]int, len(g.Territory))
	tiletypes := make([]TileType, len(g.TileTypes))
	deposits := make([]Material, len(g.Deposits))
	terrain := make([]Terrain, len(g.Terrain))

	for tile, _ := range territory {
		territory[tile] = -1
		terrain[tile] = Fog
	}

	for tile, terr := range g.Territory {
		if terr == player {
			planet, x, y := g.tileToCoord(tile)
			tiles := []int{
				tile,
				g.tileFromCoord(planet, x-1, y+1),
				g.tileFromCoord(planet, x-1, y),
				g.tileFromCoord(planet, x-1, y-1),
				g.tileFromCoord(planet, x, y+1),
				g.tileFromCoord(planet, x, y-1),
				g.tileFromCoord(planet, x+1, y+1),
				g.tileFromCoord(planet, x+1, y),
				g.tileFromCoord(planet, x+1, y-1),
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

		if g.Terrain[tile] == Ocean && g.Armies[tile] != 0 {
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
	if g.Pollution >= 100*1000 {
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

	if g.TileTypes[tile] != "" || g.Terrain[tile] == Ocean {
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
			if g.Territory[tile] == -1 && g.Armies[tile] == 0 && g.Terrain[tile] == Land {
				g.Territory[tile] = player
				g.Armies[tile] = 1
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

func NewGame(players []string, fog bool) *Game {
	g := new(Game)
	g.Fog = fog

	g.Armies = make([]uint32, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Territory = make([]int, EarthSize*EarthSize+MarsSize*MarsSize)
	g.TileTypes = make([]TileType, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Deposits = make([]Material, EarthSize*EarthSize+MarsSize*MarsSize)
	g.Terrain = make([]Terrain, EarthSize*EarthSize+MarsSize*MarsSize)

	g.Players = players
	g.Stats = make([]PlayerStat, len(players))
	for player, _ := range g.Stats {
		g.Stats[player].Materials = make(map[Material]uint)
	}

	for tile, _ := range g.Territory {
		g.Territory[tile] = -1
	}

	for tile := 0; tile < EarthSize*EarthSize; tile++ {
		g.Terrain[tile] = Ocean
	}

	islandCenters := make([]int, 0)
	// Big Islands
	for i := 0; i < 6; i++ {
		var x, y uint
		var islandCenter int

		// Get islandCenter
		for {
			x = uint(rand.Intn(EarthSize-6)) + 3
			y = uint(rand.Intn(EarthSize-6)) + 3
			islandCenter = g.tileFromCoord(Earth, x, y)

			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := g.tileToCoord(oldCenter)

				if (x-oldX < 12 || oldX-x < 12) && (y-oldY < 12 || oldY-y < 12) {
					tooClose = true
					break
				}
			}

			if !tooClose {
				break
			}
		}

		tiles := make([]int, 0)
		for j := x - 4; j <= x+4; j++ {
			tile := g.tileFromCoord(Earth, j, y)
			if tile >= 0 {
				tiles = append(tiles, tile)
			}
		}

		// Complete tiles
		topY := int(y)
		topXstart := int(x - 4)
		topXend := int(x + 4)

		bottomY := int(y)
		bottomXstart := int(x - 4)
		bottomXend := int(x + 4)
		for {
			topXstart += rand.Intn(3)
			topXend -= rand.Intn(3)
			topY -= 1

			bottomY += 1
			bottomXstart += rand.Intn(3)
			bottomXend -= rand.Intn(3)

			if topXstart >= topXend && bottomXstart >= bottomXend {
				break
			}

			if topY >= 0 {
				for j := topXstart; j <= topXend; j++ {
					if j >= 0 {
						tile := g.tileFromCoord(Earth, uint(j), uint(topY))
						if tile >= 0 {
							tiles = append(tiles, tile)
						}
					}
				}
			}

			if bottomY < EarthSize {
				for j := bottomXstart; j <= bottomXend; j++ {
					if j >= 0 {
						tile := g.tileFromCoord(Earth, uint(j), uint(bottomY))
						if tile >= 0 {
							tiles = append(tiles, tile)
						}
					}
				}
			}
		}

		islandCenters = append(islandCenters, islandCenter)

		for _, tile := range tiles {
			if tile >= 0 {
				g.Terrain[tile] = Land
			}
		}

		// Copper
		{
			_, x, y := g.tileToCoord(tiles[rand.Intn(len(tiles))])
			dTiles := []int{
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

			for _, tile := range dTiles {
				if tile >= 0 {
					g.Deposits[tile] = Copper
					g.Terrain[tile] = Land
				}
			}
		}

		// Iron
		{
		outer:
			for {
				_, x, y := g.tileToCoord(tiles[rand.Intn(len(tiles))])
				dTiles := []int{
					g.tileFromCoord(Earth, x, y),
					g.tileFromCoord(Earth, x+1, y),
					g.tileFromCoord(Earth, x, y+1),
					g.tileFromCoord(Earth, x+1, y+1),
				}

				for _, tile := range dTiles {
					if tile >= 0 {
						if g.Deposits[tile] != "" {
							continue outer
						}
					}
				}

				for _, tile := range dTiles {
					if tile >= 0 {
						g.Deposits[tile] = Iron
						g.Terrain[tile] = Land
					}
				}
				break
			}
		}
	}

	// Cores
	for i := 0; i < len(players); i++ {
		_, x, y := g.tileToCoord(islandCenters[i])
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
			g.Terrain[tile] = Land
		}
		g.Armies[tile] = 15
		g.TileTypes[tile] = Core
		g.TileTypes[kilnTile] = Kiln
	}

	// Small Islands
	for i := 0; i < 7; i++ {
		var x, y uint
		for {
			x = uint(rand.Intn(EarthSize - 1))
			y = uint(rand.Intn(EarthSize - 1))
			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := g.tileToCoord(oldCenter)

				if (x-oldX < 8 || oldX-x < 8) && (y-oldY < 8 || oldY-y < 8) {
					tooClose = true
					break
				}
			}
			if !tooClose {
				break
			}
		}
		goldTile := g.tileFromCoord(Earth, x, y)
		islandCenters = append(islandCenters, goldTile)

		tiles := []int{
			goldTile,
			g.tileFromCoord(Earth, x+1, y),
			g.tileFromCoord(Earth, x, y+1),
			g.tileFromCoord(Earth, x+1, y+1),
		}

		// these are guarenteed not to be -1
		for _, tile := range tiles {
			g.Terrain[tile] = Land
		}

		if i < 3 {
			g.Deposits[goldTile] = Gold
		} else {
			for _, tile := range tiles {
				g.Deposits[tile] = Iron
			}
		}
	}

	// Uranium
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

	planet, x, y := g.tileToCoord(tile)

	for nX := x - 2; nX <= x+2; nX++ {
		for nY := y - 2; nY <= y+2; nY++ {
			nTile := g.tileFromCoord(planet, nX, nY)
			if nTile >= 0 {
				if g.TileTypes[nTile] == BrickWall || g.TileTypes[nTile] == CopperWall || g.TileTypes[nTile] == IronWall {
					damage := map[TileType]uint32{
						BrickWall:  50,
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

					g.checkLoser(g.Territory[nTile])
				}
			}
		}
	}

	if planet == Earth {
		g.Pollution += 5000
	}

	return nil
}
