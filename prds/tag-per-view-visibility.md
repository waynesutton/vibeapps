# Tag per-view visibility

Admins can hide a tag from the StoryDetail page and the StoryList views independently, while still controlling header visibility and full archive state. This lets us hide custom submission tags (for example resendhackathon, ychackathon) from public app cards and detail pages without hardcoding names.

## Goals

Give admins granular control over where a tag renders. A tag can stay usable for filtering and routing while being hidden from specific public surfaces.

## Data model

Add two optional boolean fields to the tags table.

- hideInStoryDetail hides the tag on the single app detail page tag list
- hideInStoryList hides the tag on the homepage and category app card lists (list, grid, vibe)

Existing fields keep their meaning.

- showInHeader controls header navigation visibility
- isHidden archives the tag everywhere and removes it from public queries

## Admin controls

TagManagement gets two new per-tag toggle buttons next to the existing header and archive toggles. Each toggle marks the tag modified and persists on Save through the existing create and update mutations.

## Rendering rules

StoryDetail filters out tags where hideInStoryDetail is true. StoryList filters out tags where hideInStoryList is true. Both keep the existing isHidden filter. The two resolved fields flow through the story tag resolution helper so the client can filter.

## Out of scope

No change to tag routing, tag pages, header queries, or the submission flow. No design or color changes beyond the two new toggle buttons.
