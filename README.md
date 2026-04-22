# LUMINA Roadmap

## Spatial Hierarchy (Locked)
- **Universe** = all category galaxies.
- **Galaxy** = top-level category cluster.
- **Solar/cluster level** = subcategory or grouped job region.
- **Planet** = individual job.
- **Moon / satellite** = secondary attached data around a job.

*Purpose*: Gives the world more depth and provides room to represent supporting information without overcrowding the main planet layer.

## Moons and Satellites Product Rule
- **Primary rule**: Planets remain the primary clickable object for the main job card. Moons and satellites act as secondary indicators (unless decided later that they merit direct interaction). This keeps the scene readable and prevents the job layer from becoming noisy.
- **Moons**: Subordinate job attributes or related sub-items. Visually softer and more organic.
  - *Examples*: Pending substep, permit, revisit, or related dependency.
- **Satellites**: Operational metadata or system-linked objects. Visually more technical and machine-like.
  - *Examples*: Communication state, attachments, scheduling, route relevance, or AI/watch status.

## Locked HUD Rule: Map Mode Widget Behavior
- **Single click on a widget:** normal focus/select behavior.
- **Double click on a widget in map mode:** isolate that category on the map.
- **Double click again on the same widget:** clear isolation and show all jobs again.
- **Visual Latching:** The filtered widget becomes visually "latched" while the map is isolated, providing instant visual feedback that the map is in a filtered state. Stable visual indication is critical for context-adaptive controls.
*Purpose*: Provides a fast field-planning workflow without requiring a separate filter drawer.

## Universal Job Info Card
- The job info card is the universal detail surface across both galaxy mode and map mode.
- Whether a user clicks a 3D planet or a 2D map pin, they receive the exact same holographic card experience.
*Purpose*: This consistency reduces cognitive load and ensures the environment feels like a single, unified system rather than disparate applications stitched together.

## Locked Map Concept
- The map is an operational mode dedicated to the Seattle/Puget Sound service territory, not a generic mini-map.
- **Cinematic Transition:** Transitioning to the map feels like a seamless dive from galaxy scale down to Earth scale, handing off into a dark tactical map once the Seattle region is reached.
- **Map Mode Visuals:**
  - Pins use specific job category colors.
  - Labels are minimal, displaying only the job number.
  - Clicking a pin opens the same holographic job card used in galaxy mode.
- **Persistent Branding:** The NorthSky watermark/logo remains persistent across every mode (galaxy, solar system, and tactical map) to act as a constant signature surface.

## Map Mode Feature Layers
To ensure elegance alongside real operational planning utility, the map comprises three structural layers:
- **Layer 1 - Navigation Transition:** The HUD map button triggers the galaxy-to-Earth-to-Seattle visual dive.
- **Layer 2 - Tactical Map View:** A dark-themed Puget Sound map rendering clickable job pins with minimal labels.
- **Layer 3 - Planning Tools:** Operational tools for distance measuring between jobs and multi-stop route planning to organize field orders.
*Purpose*: Separates structural orientation, task selection, and operational planning into distinct capabilities, avoiding a single cluttered interface and supporting real field-planning workflows.

## Job Card (Locked Rules)
- **One universal card component** for galaxy mode, planet mode, and map mode.
- **Opens from any selected job object:** planet, pin, search result, or HUD-driven selection.
- **Uses the same category color language** as the rest of the system.
- **Stays minimal, premium, and operational** rather than decorative.

### Content Structure
The card must contain only:
- Job number
- Category / status
- Address and city/region
- Notes / project notes
- Optional quick actions later, only if truly useful

*Purpose*: Keeps it readable and mission-focused.

### Behavior Rules
- Single selected job = one card.
- Opening a new job replaces the prior card.
- The card should float as a HUD overlay, not live inside the map or scene itself.
- The card should feel like a holographic slab, with clean neon edging and restrained glow.
