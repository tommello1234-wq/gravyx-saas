

## Plan: Custom Aspect Ratio Input

Allow users to type any custom aspect ratio (e.g. `3:2`, `21:9`, `7:5`) in addition to the existing presets.

### Changes in `src/components/nodes/ResultNode.tsx`

1. **Add "Custom" option** to `formatOptions` array with value `'custom'`
2. **Add state** `customRatio` (string, e.g. `"3:2"`) for the custom input
3. **When "Custom" is selected** in the Popover, show an inline input field (e.g. `W:H` format) with a confirm button inside the popover
4. **Validate input** — must match pattern `number:number`, both > 0
5. **Store the custom value** in `aspectRatio` on the node data (e.g. `"3:2"`)
6. **Update `AspectIcon`** to dynamically calculate rectangle proportions for any `W:H` string, not just the hardcoded presets

### Changes in `src/pages/Editor.tsx`

7. **Parse custom ratios** in `generateForResult` — if `aspectRatio` is not one of the 4 presets or `'auto'`, parse `W:H` to compute the actual ratio and map it to the closest supported generation format, or pass it directly if the API supports arbitrary ratios

### UX Flow

- User opens format dropdown → sees presets (1:1, 4:5, 16:9, 9:16, Auto) + **Personalizado** at the bottom
- Clicking "Personalizado" reveals a small `W` × `H` input row inside the popover
- User types values and confirms → popover closes, trigger shows the custom ratio (e.g. "3:2" with a dynamically sized icon)

