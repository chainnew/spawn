# Snake Game - Complete Edition
# Run with: source .venv/bin/activate && python snake_game.py

import pygame
import random
import sys
from enum import Enum
from typing import List, Tuple

# === CONFIG ===
pygame.init()
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 600
CELL_SIZE = 20
GRID_WIDTH = WINDOW_WIDTH // CELL_SIZE
GRID_HEIGHT = WINDOW_HEIGHT // CELL_SIZE
FPS = 12

# Colors (RGB)
BLACK = (0, 0, 0)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BLUE = (0, 100, 255)
WHITE = (255, 255, 255)
YELLOW = (255, 255, 0)
PURPLE = (128, 0, 128)
ORANGE = (255, 165, 0)

FONT_LARGE = pygame.font.Font(None, 74)
FONT_MEDIUM = pygame.font.Font(None, 48)
FONT_SMALL = pygame.font.Font(None, 36)

class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)

class GameState(Enum):
    PLAYING = 1
    PAUSED = 2
    GAME_OVER = 3
    NEW_HIGH_SCORE = 4

class PowerUp:
    def __init__(self, x: int, y: int, type: str = 'speed'):
        self.x = x
        self.y = y
        self.type = type  # 'speed', 'score', 'invincible'
        self.color = {'speed': ORANGE, 'score': YELLOW, 'invincible': PURPLE}[type]
        self.lifetime = 300  # frames
        
    def update(self) -> bool:
        self.lifetime -= 1
        return self.lifetime > 0

class SnakeGame:
    def __init__(self):
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption('Snake Game - ARCHITECT Edition')
        self.clock = pygame.time.Clock()
        self.reset_game()
        
    def reset_game(self):
        self.snake = [(GRID_WIDTH//2, GRID_HEIGHT//2)]
        self.direction = Direction.RIGHT
        self.food = self.generate_food()
        self.powerups: List[PowerUp] = []
        self.score = 0
        self.high_score = self.load_high_score()
        self.state = GameState.PLAYING
        self.invincible = False
        self.invincible_timer = 0
        self.speed = FPS
        
    def generate_food(self) -> Tuple[int, int]:
        while True:
            food = (random.randint(0, GRID_WIDTH-1), random.randint(0, GRID_HEIGHT-1))
            if food not in self.snake:
                return food
                
    def generate_powerup(self):
        if random.random() < 0.3 and len(self.powerups) < 2:  # 30% chance
            x = random.randint(0, GRID_WIDTH-1)
            y = random.randint(0, GRID_HEIGHT-1)
            if (x, y) not in self.snake and (x, y) != self.food:
                types = ['speed', 'score', 'invincible']
                powerup_type = random.choice(types)
                self.powerups.append(PowerUp(x, y, powerup_type))
    
    def load_high_score(self) -> int:
        try:
            with open('high_score.txt', 'r') as f:
                return int(f.read())
        except:
            return 0
            
    def save_high_score(self):
        if self.score > self.high_score:
            self.high_score = self.score
            with open('high_score.txt', 'w') as f:
                f.write(str(self.high_score))
            return True
        return False
    
    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    return False
                elif self.state == GameState.PLAYING:
                    if event.key == pygame.K_UP and self.direction != Direction.DOWN:
                        self.direction = Direction.UP
                    elif event.key == pygame.K_DOWN and self.direction != Direction.UP:
                        self.direction = Direction.DOWN
                    elif event.key == pygame.K_LEFT and self.direction != Direction.RIGHT:
                        self.direction = Direction.LEFT
                    elif event.key == pygame.K_RIGHT and self.direction != Direction.LEFT:
                        self.direction = Direction.RIGHT
                    elif event.key == pygame.K_p:
                        self.state = GameState.PAUSED
                elif self.state in [GameState.GAME_OVER, GameState.NEW_HIGH_SCORE]:
                    if event.key == pygame.K_r or event.key == pygame.K_RETURN:
                        self.reset_game()
                    elif event.key == pygame.K_q or event.key == pygame.K_ESCAPE:
                        return False
                elif self.state == GameState.PAUSED and event.key == pygame.K_p:
                    self.state = GameState.PLAYING
        return True
    
    def update(self):
        if self.state != GameState.PLAYING:
            return
            
        # Move snake
        head_x, head_y = self.snake[0]
        dx, dy = self.direction.value
        new_head = (head_x + dx, head_y + dy)
        
        # Check wall collision
        if (new_head[0] < 0 or new_head[0] >= GRID_WIDTH or 
            new_head[1] < 0 or new_head[1] >= GRID_HEIGHT):
            if not self.invincible:
                self.game_over()
                return
            else:
                new_head = (new_head[0] % GRID_WIDTH, new_head[1] % GRID_HEIGHT)
        
        # Check self collision
        if new_head in self.snake and not self.invincible:
            self.game_over()
            return
            
        self.snake.insert(0, new_head)
        
        # Check food collision
        if new_head == self.food:
            self.score += 10
            self.food = self.generate_food()
            self.generate_powerup()
        else:
            self.snake.pop()
            
        # Check powerup collisions
        for powerup in self.powerups[:]:
            if new_head == (powerup.x, powerup.y):
                if powerup.type == 'speed':
                    self.speed += 2
                elif powerup.type == 'score':
                    self.score += 50
                elif powerup.type == 'invincible':
                    self.invincible = True
                    self.invincible_timer = 300  # 5 seconds at 10 FPS
                self.powerups.remove(powerup)
        
        # Update invincible timer
        if self.invincible:
            self.invincible_timer -= 1
            if self.invincible_timer <= 0:
                self.invincible = False
        
        # Update powerups
        self.powerups = [p for p in self.powerups if p.update()]
    
    def game_over(self):
        new_high = self.save_high_score()
        self.state = GameState.NEW_HIGH_SCORE if new_high else GameState.GAME_OVER
    
    def draw(self):
        self.screen.fill(BLACK)
        
        if self.state == GameState.PLAYING or self.state == GameState.PAUSED:
            # Draw snake
            color = BLUE if self.invincible else GREEN
            for i, segment in enumerate(self.snake):
                rect = pygame.Rect(segment[0]*CELL_SIZE, segment[1]*CELL_SIZE, 
                                 CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(self.screen, color, rect)
                if i == 0:  # Head
                    pygame.draw.rect(self.screen, WHITE, rect, 2)
            
            # Draw food
            food_rect = pygame.Rect(self.food[0]*CELL_SIZE, self.food[1]*CELL_SIZE,
                                  CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(self.screen, RED, food_rect)
            
            # Draw powerups
            for powerup in self.powerups:
                rect = pygame.Rect(powerup.x*CELL_SIZE, powerup.y*CELL_SIZE,
                                 CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(self.screen, powerup.color, rect)
                pygame.draw.rect(self.screen, WHITE, rect, 2)
            
            # Score
            score_text = FONT_SMALL.render(f'Score: {self.score}', True, WHITE)
            self.screen.blit(score_text, (10, 10))
            
            high_score_text = FONT_SMALL.render(f'High: {self.high_score}', True, WHITE)
            self.screen.blit(high_score_text, (WINDOW_WIDTH - 150, 10))
            
            if self.invincible:
                inv_text = FONT_SMALL.render('INVINCIBLE!', True, YELLOW)
                self.screen.blit(inv_text, (WINDOW_WIDTH//2 - 60, 10))
            
            if self.state == GameState.PAUSED:
                pause_text = FONT_LARGE.render('PAUSED', True, WHITE)
                self.screen.blit(pause_text, (WINDOW_WIDTH//2 - 100, WINDOW_HEIGHT//2))
        
        elif self.state == GameState.GAME_OVER:
            game_over_text = FONT_LARGE.render('GAME OVER', True, RED)
            self.screen.blit(game_over_text, (WINDOW_WIDTH//2 - 150, WINDOW_HEIGHT//2 - 50))
            restart_text = FONT_MEDIUM.render('R to restart, Q to quit', True, WHITE)
            self.screen.blit(restart_text, (WINDOW_WIDTH//2 - 140, WINDOW_HEIGHT//2 + 20))
            
        elif self.state == GameState.NEW_HIGH_SCORE:
            game_over_text = FONT_LARGE.render('NEW HIGH SCORE!', True, YELLOW)
            self.screen.blit(game_over_text, (WINDOW_WIDTH//2 - 200, WINDOW_HEIGHT//2 - 50))
            score_text = FONT_MEDIUM.render(f'{self.high_score}', True, WHITE)
            self.screen.blit(score_text, (WINDOW_WIDTH//2 - 30, WINDOW_HEIGHT//2))
            restart_text = FONT_MEDIUM.render('R to restart, Q to quit', True, WHITE)
            self.screen.blit(restart_text, (WINDOW_WIDTH//2 - 140, WINDOW_HEIGHT//2 + 50))
        
        pygame.display.flip()
    
    def run(self):
        running = True
        while running:
            running = self.handle_input()
            self.update()
            self.draw()
            self.clock.tick(self.speed)
        
        pygame.quit()
        sys.exit()

if __name__ == '__main__':
    game = SnakeGame()
    game.run()
