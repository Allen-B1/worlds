package main

type Patcher struct {
	g              *Game
	playerIndex    int
	armiesCache    []uint32
	territoryCache []int
	terrainCache   []Terrain
	tileTypesCache []TileType
	depositsCache  []Material
}

func NewPatcher(g *Game, playerIndex int) *Patcher {
	return &Patcher{
		g:           g,
		playerIndex: playerIndex,
	}
}

func (p *Patcher) applyFog() (armies []uint32, territory []int, terrain []Terrain, tiletypes []TileType, deposits []Material) {
	armies = make([]uint32, len(p.g.Armies))
	territory = make([]int, len(p.g.Territory))
	tiletypes = make([]TileType, len(p.g.TileTypes))
	deposits = make([]Material, len(p.g.Deposits))
	terrain = make([]Terrain, len(p.g.Terrain))

	if !p.g.Fog {
		copy(armies, p.g.Armies)
		copy(territory, p.g.Territory)
		copy(tiletypes, p.g.TileTypes)
		copy(deposits, p.g.Deposits)
		copy(terrain, p.g.Terrain)
		return
	}

	for tile, _ := range territory {
		territory[tile] = -1
		terrain[tile] = Fog
	}

	for tile, terr := range p.g.Territory {
		if terr == p.playerIndex || p.g.Relationships[p.g.association(terr, p.playerIndex)] == Allies {
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
					territory[knownTile] = p.g.Territory[knownTile]
					armies[knownTile] = p.g.Armies[knownTile]
					tiletypes[knownTile] = p.g.TileTypes[knownTile]
					terrain[knownTile] = p.g.Terrain[knownTile]
					deposits[knownTile] = p.g.Deposits[knownTile]
				}
			}
		}
	}

	return armies, territory, terrain, tiletypes, deposits
}

func (p *Patcher) Start() *PatcherStart {
	p.armiesCache, p.territoryCache, p.terrainCache, p.tileTypesCache, p.depositsCache = p.applyFog()

	return &PatcherStart{
		Armies:    p.armiesCache,
		Territory: p.territoryCache,
		Terrain:   p.terrainCache,
		TileTypes: p.tileTypesCache,
		Deposits:  p.depositsCache,

		Players:     p.g.Players,
		PlayerIndex: p.playerIndex,
	}
}

func (p *Patcher) Update() *PatcherUpdate {
	out := new(PatcherUpdate)

	out.ArmiesDiff = make(map[int]uint32)
	out.TerritoryDiff = make(map[int]int)
	out.TerrainDiff = make(map[int]Terrain)
	out.TileTypesDiff = make(map[int]TileType)
	out.DepositsDiff = make(map[int]Material)

	newArmies, newTerritory, newTerrain, newTileTypes, newDeposits := p.applyFog()
	for index, val := range newArmies {
		if val != p.armiesCache[index] {
			out.ArmiesDiff[index] = val
		}
	}
	for index, val := range newTerritory {
		if val != p.territoryCache[index] {
			out.TerritoryDiff[index] = val
		}
	}
	for index, val := range newTerrain {
		if val != p.terrainCache[index] {
			out.TerrainDiff[index] = val
		}
	}
	for index, val := range newTileTypes {
		if val != p.tileTypesCache[index] {
			out.TileTypesDiff[index] = val
		}
	}
	for index, val := range newDeposits {
		if val != p.depositsCache[index] {
			out.DepositsDiff[index] = val
		}
	}

	p.armiesCache = newArmies
	p.territoryCache = newTerritory
	p.terrainCache = newTerrain
	p.tileTypesCache = newTileTypes
	p.depositsCache = newDeposits

	for tile, player := range p.g.Electricity {
		if player == p.playerIndex {
			out.Electricity = append(out.Electricity, tile)
		}
	}

	out.Losers = p.g.Losers
	out.Stats = p.g.Stats

	relationships := make([]Relationship, len(p.g.Players))
	for player2, _ := range relationships {
		relationships[player2] = p.g.Relationships[p.g.association(p.playerIndex, player2)]
	}
	out.Relationships = relationships

	requests := make([]int, 0)
	for i, _ := range p.g.Players {
		if p.g.Requests[p.g.association(p.playerIndex, i)] == i {
			requests = append(requests, i)
		}
	}
	out.Requests = requests

	out.Turn = p.g.Turn
	out.Pollution = p.g.Pollution
	out.Amounts = p.g.Amounts[p.playerIndex]

	return out
}

type PatcherStart struct {
	Armies    []uint32   `json:"armies"`
	Territory []int      `json:"territory"`
	Terrain   []Terrain  `json:"terrain"`
	TileTypes []TileType `json:"tiletypes"`
	Deposits  []Material `json:"deposits"`

	Players     []string `json:"players"`
	PlayerIndex int      `json:"playerIndex"`
}

type PatcherUpdate struct {
	ArmiesDiff    map[int]uint32   `json:"armies_diff"`
	TerritoryDiff map[int]int      `json:"territory_diff"`
	TerrainDiff   map[int]Terrain  `json:"terrain_diff"`
	TileTypesDiff map[int]TileType `json:"tiletypes_diff"`
	DepositsDiff  map[int]Material `json:"deposits_diff"`

	Electricity []int `json:"electricity"`

	Losers        []int          `json:"losers"`
	Stats         []Stats        `json:"stats"`
	Requests      []int          `json:"requests"`
	Relationships []Relationship `json:"relationships"`

	Turn      uint            `json:"turn"`
	Pollution uint            `json:"pollution"`
	Amounts   MaterialAmounts `json:"amounts"`
}
