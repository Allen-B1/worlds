package main

import (
	"math/rand"
)

type Map struct {
	Terrain  []Terrain
	Walls    []TileType
	Deposits []Material
	Spawns   []int
}

func NewRandomMap() *Map {
	m := new(Map)
	m.Terrain = make([]Terrain, EarthSize*EarthSize+MarsSize*MarsSize)
	m.Walls = make([]TileType, EarthSize*EarthSize+MarsSize*MarsSize)
	m.Deposits = make([]Material, EarthSize*EarthSize+MarsSize*MarsSize)

	for tile := 0; tile < EarthSize*EarthSize; tile++ {
		m.Terrain[tile] = Ocean
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
			islandCenter = tileFromCoord(Earth, x, y)

			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := tileToCoord(oldCenter)

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
			tile := tileFromCoord(Earth, j, y)
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
						tile := tileFromCoord(Earth, uint(j), uint(topY))
						if tile >= 0 {
							tiles = append(tiles, tile)
						}
					}
				}
			}

			if bottomY < EarthSize {
				for j := bottomXstart; j <= bottomXend; j++ {
					if j >= 0 {
						tile := tileFromCoord(Earth, uint(j), uint(bottomY))
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
				m.Terrain[tile] = Land
			}
		}

		// Iron
		{
		outer:
			for {
				_, x, y := tileToCoord(tiles[rand.Intn(len(tiles))])
				dTiles := []int{
					tileFromCoord(Earth, x, y),
					tileFromCoord(Earth, x+1, y),
					tileFromCoord(Earth, x, y+1),
					tileFromCoord(Earth, x+1, y+1),
				}

				for _, tile := range dTiles {
					if tile >= 0 {
						if m.Deposits[tile] != "" {
							continue outer
						}
					}
				}

				for _, tile := range dTiles {
					if tile >= 0 {
						m.Deposits[tile] = Iron
						m.Terrain[tile] = Land
					}
				}

				lTiles := []int{
					tileFromCoord(Earth, x-1, y),
					tileFromCoord(Earth, x-1, y+1),
					tileFromCoord(Earth, x+2, y),
					tileFromCoord(Earth, x+2, y+1),
					tileFromCoord(Earth, x, y-1),
					tileFromCoord(Earth, x+1, y-1),
					tileFromCoord(Earth, x, y+2),
					tileFromCoord(Earth, x+1, y+2),
				}

				for _, tile := range lTiles {
					if tile >= 0 {
						m.Terrain[tile] = Land
					}
				}

				break
			}
		}
	}

	// Iron / Coal Islands
	for i := 0; i < 5; i++ {
		var x, y uint
		for {
			x = uint(rand.Intn(EarthSize-2)) + 1
			y = uint(rand.Intn(EarthSize-2)) + 1
			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := tileToCoord(oldCenter)

				if (x-oldX < 11 || oldX-x < 11) && (y-oldY < 11 || oldY-y < 11) {
					tooClose = true
				}
			}

			if !tooClose {
				break
			}
		}
		centerTile := tileFromCoord(Earth, x, y)
		islandCenters = append(islandCenters, centerTile)

		tiles := []int{
			centerTile,
			tileFromCoord(Earth, x+1, y),
			tileFromCoord(Earth, x+1, y+1),
			tileFromCoord(Earth, x, y+1),

			tileFromCoord(Earth, x, y-1),
			tileFromCoord(Earth, x+1, y-1),
			tileFromCoord(Earth, x, y+2),
			tileFromCoord(Earth, x+1, y+2),
			tileFromCoord(Earth, x-1, y),
			tileFromCoord(Earth, x+2, y),
			tileFromCoord(Earth, x-1, y+1),
			tileFromCoord(Earth, x+2, y+1),

			tileFromCoord(Earth, x+2, y+2),
			tileFromCoord(Earth, x-1, y-1),
			tileFromCoord(Earth, x-1, y+2),
			tileFromCoord(Earth, x+2, y-1),
		}

		tiles[rand.Intn(4)+12] = -1

		material := Iron
		if i >= 2 {
			material = Coal
		}

		for i, tile := range tiles {
			if tile != -1 {
				m.Terrain[tile] = Land
				if i < 4 {
					m.Deposits[tile] = material
				}
			}
		}
	}

	// Gold Islands
	for i := 0; i < 6; i++ {
		var x, y uint
		for {
			x = uint(rand.Intn(EarthSize-2)) + 1
			y = uint(rand.Intn(EarthSize-2)) + 1
			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := tileToCoord(oldCenter)

				if (x-oldX < 9 || oldX-x < 9) && (y-oldY < 9 || oldY-y < 9) {
					tooClose = true
				}
			}

			if !tooClose {
				break
			}
		}
		centerTile := tileFromCoord(Earth, x, y)
		islandCenters = append(islandCenters, centerTile)

		tiles := []int{
			centerTile,
			tileFromCoord(Earth, x+1, y+1),
			tileFromCoord(Earth, x-1, y-1),
			tileFromCoord(Earth, x-1, y+1),
			tileFromCoord(Earth, x+1, y-1),
			tileFromCoord(Earth, x+1, y),
			tileFromCoord(Earth, x, y+1),
			tileFromCoord(Earth, x-1, y),
			tileFromCoord(Earth, x, y-1),
		}

		// Remove one corner tile randomly
		// [1,4]
		tiles[rand.Intn(4)+1] = -1

		for _, tile := range tiles {
			if tile != -1 {
				m.Terrain[tile] = Land
			}
		}

		m.Deposits[centerTile] = Gold
	}

	// Tiny Islands
	for i := 0; i < 8; i++ {
		var x, y uint
		for {
			x = uint(rand.Intn(EarthSize-2)) + 1
			y = uint(rand.Intn(EarthSize-2)) + 1
			tooClose := false
			for _, oldCenter := range islandCenters {
				_, oldX, oldY := tileToCoord(oldCenter)

				if (x-oldX < 5 || oldX-x < 5) && (y-oldY < 5 || oldY-y < 5) {
					tooClose = true
					break
				}
			}

			if !tooClose {
				break
			}
		}
		centerTile := tileFromCoord(Earth, x, y)
		islandCenters = append(islandCenters, centerTile)

		tiles := []int{
			centerTile,
			tileFromCoord(Earth, x+1, y),
		}

		if rand.Intn(2) == 0 {
			tiles[1] = tileFromCoord(Earth, x, y+1)
		}

		// cannot be -1
		for _, tile := range tiles {
			m.Terrain[tile] = Land

			if rand.Intn(8) == 0 {
				m.Deposits[tile] = Iron
			}
			if rand.Intn(8) == 0 {
				m.Deposits[tile] = Coal
			}
			if rand.Intn(32) == 0 {
				m.Deposits[tile] = Green
			}
		}
	}

	// Uranium
	for i := 0; i < 8; i++ {
		x := uint(rand.Intn(MarsSize - 1))
		y := uint(rand.Intn(MarsSize - 1))
		tiles := []int{
			tileFromCoord(Mars, x, y),
			tileFromCoord(Mars, x+1, y),
			tileFromCoord(Mars, x, y+1),
			tileFromCoord(Mars, x+1, y+1),
		}

		for _, tile := range tiles {
			m.Deposits[tile] = Uranium
		}
	}

	m.Spawns = islandCenters[:6]
	return m
}
