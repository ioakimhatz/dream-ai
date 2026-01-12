# Hard Paywall - Required Assets

## Overview
The hard paywall screen requires 2 placeholder images to be added to the assets folder.

## Required Images

### 1. Blurred Dream Preview
**Path:** `assets/images/dream-preview-blur.png`
**Purpose:** Shows at top of paywall as a blurred/locked preview of what the dream video would look like
**Specs:**
- Dimensions: 1200x800px (3:2 aspect ratio)
- Format: PNG with transparency support
- Content: Abstract dreamy image (clouds, stars, fantasy landscape) with blur effect
- Style: Purple/blue gradient tones to match app theme
- Should evoke curiosity and desire to "unlock"

**Design notes:**
- Apply 20-30px Gaussian blur
- Add subtle vignette
- Keep colors in #7C86FF - #E3C8FF range

### 2. Phone Mockup
**Path:** `assets/images/phone-mockup.png`
**Purpose:** Shows example of Dream AI video playing on iPhone
**Specs:**
- Dimensions: 800x1600px (iPhone aspect ratio)
- Format: PNG with transparency
- Content: iPhone frame with Dream AI video screenshot inside
- Style: Modern iPhone design (e.g., iPhone 15 Pro)

**Design notes:**
- Use realistic iPhone mockup template
- Show Dream AI interface with example dream video
- Video should show cinematic scene (flying, fantasy landscape, etc.)
- Include subtle drop shadow for depth
- Transparent background so it floats on gradient

## Creating the Assets

### Option 1: Design Tools
- Use Figma, Sketch, or Photoshop
- Export at 2x resolution (@2x)
- Optimize with ImageOptim or TinyPNG

### Option 2: Stock Images + Editing
1. **dream-preview-blur.png:**
   - Find dreamy/abstract image on Unsplash
   - Apply blur filter
   - Adjust colors to purple gradient

2. **phone-mockup.png:**
   - Use mockup generator (mockuphone.com, smartmockups.com)
   - Insert Dream AI screenshot
   - Export as PNG

### Option 3: AI Generation
- Use Midjourney/DALL-E for dream-preview-blur.png
- Prompt: "Blurred dreamy fantasy landscape, purple and pink gradient, clouds and stars, cinematic, ethereal"

## Temporary Placeholders

Until real assets are created, the paywall will show:
- Pink placeholder box for blurred preview
- Gray placeholder for phone mockup

The functionality will work correctly, but the visual impact will be reduced.

## Installation

Once images are created:
1. Place in `assets/images/` folder
2. Name exactly as specified above
3. Rebuild app with `npx expo start --clear`
4. Images will load automatically

## Testing

After adding images:
1. Open app and enter a dream
2. Tap "Generate Dream Cinema" (without subscription)
3. Should navigate to hard paywall
4. Verify both images display correctly
5. Test purchase flow completes and auto-generates
