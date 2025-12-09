# Fixed Sandbox Demo: Terminal-based Conway's Game of Life
# Single-file, fully self-contained. Runs in Python 3.
# ARCHITECT live demo: Write → Run → Show output!

import os
import time
import random
import sys

# === CONFIG ===
WIDTH = 60  # Smaller for demo output capture
HEIGHT = 15
GENERATIONS = 20  # Short demo run
DELAY = 0.2
ALIVE = '█'
DEAD = '░'  # Better contrast

def clear_screen():
    os.system('clear')  # Unix only, fine for sandbox

def create_grid(width, height):
    grid = [[random.choice([0, 1]) for _ in range(width)] for _ in range(height)]
    return grid

def count_neighbors(grid, x, y):
    width, height = len(grid[0]), len(grid)
    count = 0
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            if dx == 0 and dy == 0:
                continue
            nx = (x + dx) % width
            ny = (y + dy) % height
            count += grid[ny][nx]
    return count

def next_generation(grid):
    width, height = len(grid[0]), len(grid)
    new_grid = [[0] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            neighbors = count_neighbors(grid, x, y)
            cell = grid[y][x]
            if cell == 1 and neighbors in (2, 3):
                new_grid[y][x] = 1
            elif cell == 0 and neighbors == 3:
                new_grid[y][x] = 1
    return new_grid

def print_grid(grid):
    for row in grid:
        print(''.join([ALIVE if cell else DEAD for cell in row]))

# === MAIN ===
print("🚀 ARCHITECT Sandbox Demo: Conway's Game of Life")
print("Live in workspace! Capturing first few generations...")
print("Full run shows animation. Here's snapshot evolution.\n")

grid = create_grid(WIDTH, HEIGHT)
for gen in range(GENERATIONS):
    print(f"Generation {gen + 1}/{GENERATIONS}")
    print_grid(grid)
    print("-" * WIDTH)
    print()  # Spacer
    grid = next_generation(grid)
    time.sleep(DELAY)  # Minimal delay for output capture

print("🎮 Demo complete! Cells evolved autonomously.")
print("This is REAL sandbox execution: code written & run LIVE.")
