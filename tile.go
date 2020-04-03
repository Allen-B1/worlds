package main

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
}

var TileInfos = map[TileType]TileInfo{
	Core: TileInfo{
		Name: "Core",
		Cost: map[Material]uint{
			Brick:  500,
			Copper: 1000,
			Iron:   1000,
			Gold:   500,
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
	Bridge: TileInfo{
		Name: "Bridge",
		Cost: map[Material]uint{
			Iron:   10,
			Copper: 10,
		},
	},
	Launcher: TileInfo{
		Name: "Launcher",
		Cost: map[Material]uint{
			Brick:  300,
			Copper: 800,
			Iron:   500,
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
	GreenHouse: TileInfo{
		Name: "Greenhouse",
		Cost: map[Material]uint{
			Green: 50,
			Iron:  10,
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
