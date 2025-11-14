+++
date = '2025-11-13T17:20:40-06:00'
draft = false
title = 'Why ECS? A grounded explanation and justification'
+++

If you've been paying attention at all to the Roblox development community in the past few years, you've probably heard of ECS. ECS stands for *Entities-Components-Systems*, (not an Entity-Component system!) and is a software architecture for structuring entity simulations.

It's important to note that that ECS is for entity simulations, and that entity simulations are not a novel concept exclusive to ECS.
Especially in games off of Roblox, entity simulations are a default model for games. You have a world full of entities that are simulated every frame. This can already be novel to beginner Roblox developers have primarily been programming in an event-driven way.

Not every game should be structured as an entity simulation. Many games just don't have very many *things* in gameplay. Other games, such as ones in the bullet hell genre, are filled to the brim with lots of visible gameplay entities that are constantly changing. These games are a perfect example of a good use for an entity simulation. But entity simulations aren't just for simulating intuitive gameplay entities. Even in a game with relatively static gameplay, client-sided objects may need to be simulated visually, and other invisible logical processes may benefit from being entity simulations.

# But why *Entities Components Systems*?

What I want to do here is gradually develop an entity simulation, only making changes when necessary, to show you what I think are a set of **necessary principles** for decently sized entity simulations. Then I'll bridge those principles and traditional ECS dogma.

## Basic Entities

```lua
type BulletEntity = {
  type: "bullet",
  position: Vector2,
  direction: Vector2,
  speed: number,
}

type EnemyEntity = {
  type: "enemy",
  health: number,
  position: Vector2,
  direction: Vector2,
  speed: number,
}

type Entity = BulletEntity | EnemyEntity

local World: {Entity} = {}

local function simulate(dt)
  for _, entity in World do
    if entity.type == "bullet" then
      entity.position += entity.direction * entity.speed * dt
    elseif entity.type == "enemy" then
      entity.position += entity.direction * entity.speed * dt
    end
  end
end

RunService.Heartbeat:Connect(simulate)
```

So we have a world full of all kinds (two, here) of different entities, and we iterate over all of them and do different stuff to them based on what they are. The simulation happens in one big step where we process each entity once according to what it is.

We can insert entities into the world like so:
```lua
table.insert(World, {
  type = "bullet",
  position = Vector2.zero,
  direction = Vector2.xAxis,
  speed = 5,
})
```

Now let's say we want to do collision detection between the bullets and enemies: when a bullet hits an enemy, we'll delete that bullet and do damage to the enemy. Our big single iteration through every entity in the game has already broken down, for two reasons:

  1. It makes sense intuitively that we ought to move everything in the game before we check for collisions. Depending on the collision detection method this may be inoptimal, but it's more physically reasonable than say, simulating all of the bullets, then checking for collisions, and then simulating all of the enemies.

  2. Even if we didn't particularly care what order we did the steps in, they still need to be done in a consistent order. If we just iterated over the entire world (which as it is, is unordered), we'd move some of the bullets and check for their collisions, and then we'd move a few of the enemies, and then some of the bullets that might hit them, and so on.

So we'll need to have at least two different steps in some particular order where we iterate through the necessary entities and either simulate movement or collision.

*Side note*: This is one reason why I don't recommend having entities simulate themselves, inside of themselves, as is traditional in OOP entity simulations. It is usually not enough to have a bunch of entities of different classes in a world which all have a `tick(dt)` method that advances them through time. In certain simulations, the structure of the simulation is simple and defined in such a way where this is viable, but in games, I don't think this is a good idea.

## Basic Systems

```lua
local function isColliding(bullet: BulletEntity, enemy: EnemyEntity): boolean
  -- NOT IMPLEMENTED
end

local function simulate(dt)
  for _, entity in World do
    if entity.type == "bullet" then
      entity.position += entity.direction * entity.speed * dt
    elseif entity.type == "enemy" then
      entity.position += entity.direction * entity.speed * dt
    end
  end

  for bulletId, bullet in World do
    if bullet.type ~= "bullet" then continue end

    for enemyId, enemy in World do
      if enemy.type == "enemy" and isColliding(bullet, enemy) do
        enemy.health -= 1
        World[bulletId] = nil -- We leave holes in the array as not to displace the entity IDs
        break
      end
    end
  end
end

RunService.Heartbeat:Connect(function(simulate)
```

First let's recognize that we have two different "systems" here, which are doing two different things meaningfully, and that if we wanted to we could separate them out like this:

```lua
local function moveEntities(dt)
  for _, entity in world do
    if entity.type == "bullet" then
      entity.position += entity.direction * entity.speed * dt
    elseif entity.type == "enemy" then
      entity.position += entity.direction * entity.speed * dt
    end
  end
end

local function checkBulletCollisions()
  for bulletId, bullet in World do
    if bullet.type ~= "bullet" then continue end

    for enemyId, enemy in World do
      if enemy.type == "enemy" and isColliding(bullet, enemy) do
        enemy.health -= 1
        World[bulletId] = nil -- We leave holes in the array as not to displace the entity IDs
        break
      end
    end
  end
end

local function simulate(dt)
  moveEntities(dt)
  checkBulletCollisions()
end
```

But more importantly, we have some glaring problems. 

1. We are iterating over the entire world only to find the bullets of whom we need to check for collisions. For large entity counts, this is already inefficient because we end up doing multiple iterations over the entire world every frame, even for systems that only operate on a certain subset of entities.

2. For every bullet, we have to iterate over the whole world *again* and match for enemies to detect collision with. This system runs in exponential time according to the size of the entire world, which may be comprised of thousands of entities that are not relevant to the system.

These inefficiencies are intuitively represented in the fact that by naming the iteration variable for the top-level loop `bullet`, we have awkwardly asserted that every entity we are iterating over is a bullet, which is false. But if we were to name them anything else we would lose the idea that we only mean to act on the bullets; that every entity we are doing meaningful work on is a bullet and so *effectively* we are iterating over the bullets. If nothing else, the procedure occuring and our a priori intentions are misaligned.