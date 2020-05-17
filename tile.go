package main

import (
	"encoding/json"
	"io/ioutil"
)

type Planet string

const (
	Mars  Planet = "mars"
	Earth Planet = "earth"

	MarsSize  = 24 // 24*24
	EarthSize = 48 // 48*48
)

type TileType string

const (
	Core TileType = "core"
	Camp TileType = "camp"

	Bridge TileType = "bridge"

	Kiln   TileType = "kiln"
	MineV1 TileType = "mine1"
	MineV2 TileType = "mine2"
	MineV3 TileType = "mine3"

	IronWall   TileType = "iron-wall"
	CopperWall TileType = "copper-wall"

	Launcher TileType = "launcher"
	Cleaner  TileType = "cleaner"

	GreenHouse TileType = "greenhouse"
)

type TileInfo struct {
	Name      string            `json:"name"`
	Pollution uint              `json:"pollution"`
	Cost      map[Material]uint `json:"cost"`
	Category  string            `json:"category"`
	Strength  uint32            `json:"strength"`
	Village   bool              `json:"village"`
}

type Material string

const (
	Brick   Material = "brick"
	Copper  Material = "copper"
	Iron    Material = "iron"
	Gold    Material = "gold"
	Uranium Material = "uranium"
	Green   Material = "green"
)

type Terrain string

const (
	Land  Terrain = ""
	Ocean Terrain = "ocean"
	Fog   Terrain = "fog"
)

func tileToCoord(id int) (planet Planet, x uint, y uint) {
	if id >= EarthSize*EarthSize {
		id -= EarthSize * EarthSize
		return Mars, uint(id % MarsSize), uint(id / MarsSize)
	} else {
		return Earth, uint(id % EarthSize), uint(id / EarthSize)
	}
}

func tileFromCoord(planet Planet, x uint, y uint) int {
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

var TileInfos = make(map[TileType]TileInfo)

func init() {
	bytes, err := ioutil.ReadFile("files/tileinfo.json")
	if err != nil {
		panic(err)
	}
	err = json.Unmarshal(bytes, &TileInfos)
	if err != nil {
		panic(err)
	}
}
