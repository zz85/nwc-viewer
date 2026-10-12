# Notably UI/UX philosophy

> **A music stand with a media player's manners.**
> The music fills the screen. Controls behave the way every video player
> does, then step aside while the music plays.

Clickable mockup: [`mockups/ui-concept/index.html`](mockups/ui-concept/index.html). Serve
the repo, for example `python3 -m http.server`, and open `/plans/mockups/ui-concept/`.
Playback in the mockup is simulated over a picture of a real render.

---

## 1. What people come to do, by how often

| # | Job | Today | Design budget |
|---|-----|-------|---------------|
| 1 | **Read** a score | Canvas between a dense toolbar and a footer | The whole screen |
| 2 | **Listen**: play, pause, seek, volume | Text Play/Stop, a 160 px bar, **no volume** | Always visible, YouTube-shaped |
| 3 | **Practise** a passage: loop, slow down, solo a part | Speed and solo inside Settings, no loop | One click, or straight on the score |
| 4 | **Share / export**: link, PDF, file | Save menu and Share in the toolbar | One button and one menu |
| 5 | **Fix** something small: title, a note, a text | Title only, by click | In place, on the score |
| 6 | **Tune** the look: layout, font, size, spacing | One big Settings popover | A panel you rarely open |

Rows 1–2 are what people do nearly every session. Row 6 is set once. Today all six
get the same visual weight in one toolbar, and an eight-section Settings popover
mixes Playback with Engraving, Print look, Spacing and Advanced.

## 2. Principles

1. **The score is the hero.** Chrome sits in two thin translucent bars over a
   full-bleed score, and nothing else stays on screen. Every panel collapses
   with Esc. ("More music, less user interface" was a reader's reaction to
   Noteflight's redesign: <https://www.scoringnotes.com/news/notefight-gets-major-makeover/>.)
2. **Familiar beats clever.** Playback copies the grammar people already have
   from YouTube and Spotify:
   - play at bottom left, the time next to it
   - a full-width scrub bar
   - a speaker icon for volume
   - speed in a chip or menu, fullscreen at bottom right
   - the same keys: Space or K, M, F, 0–9, < and >, ?

   We change a convention only where music needs a different unit: bars
   instead of seconds.
3. **The score is the interface.**
   - Click the music to put the playhead there.
   - Drag across bars to loop them.
   - Click the title to rename.
   - Click a note to fix it.

   Soundslice, Noteflight and Flat all work this way, and it beats any form
   ([Soundslice navigation](https://www.soundslice.com/help/en/player/basic/141/navigating-playback/),
   [looping](https://www.soundslice.com/help/en/player/basic/4/looping/)).
4. **One click for the common things, one panel for the rest.** There are three
   tiers:
   - **Always visible:** play/pause, position, scrub, volume, view.
   - **One click:** speed, loop, parts, keyboard, share, menu.
   - **A panel:** appearance, page setup, engraving, advanced.
5. **Calm when reading, alive when playing.**
   - While reading, nothing moves.
   - While playing, the playhead glows and the page follows it. After 2.5 s
     without the mouse moving, the chrome fades away, as video players do.
   - Moving the mouse or tapping brings it back.
   - Scroll by hand and following pauses; a **"Back to the playhead"** pill appears.
6. **View first, edit on purpose.**
   - Stray keys never change the score.
   - Editing starts from something you pointed at (✎ Edit, double-click or
     Enter) and ends with Esc or Done.
   - Changes show as an **Edited · Save** pill.

   Dorico separates modes and MuseScore has a Publish view for the same reason
   ([Dorico modes](https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/program_concepts/program_concepts_modes_c.html)).
7. **Nothing lost, everything shareable.**
   - Drafts are kept until you save (as today).
   - A shared link opens at the same bar, with the same loop and view.
   - Preferences are remembered.
8. **Same colour, same meaning, everywhere.** A part's colour is identical in
   the parts panel, the lit piano keys, the 3D lights and the note
   highlights. One accent colour (amber) means *now*: the playhead, the active
   control, the save pill. A second (blue) means *loop*.
9. **Mouse, keyboard, finger, pedal.**
   - Every control has a key, shown in its tooltip and on the `?` sheet.
   - Hover-revealed controls also open on tap.
   - Page view answers PgUp/PgDn and the arrow keys, so Bluetooth page-turn
     pedals work without setup (the forScore lesson:
     <https://forscore.co/documentation/page-turners/>).
10. **Never drop a feature to look simpler.** Everything that exists today
    keeps a home (see §7). MuseScore 4's redesign was criticised for losing
    features ([review](https://www.scoringnotes.com/reviews/musescore-4-0/)).
11. **Built to grow.** New capabilities plug into a fixed set of slots (see §6)
    instead of adding buttons. Situational features only appear while they
    apply. A capability that is shown nowhere is still reachable from `/`.

## 3. Look & feel

- **Surround and paper.**
  - The default **Studio** theme is a dark warm-grey surround (`#1c1c20`) with
    the score on off-white paper (`#fbfaf6`) and a soft drop shadow, like a
    lit music stand in a dim room.
  - The **Light** theme is the same paper on a pale linen surround.
  - The score itself is always ink on paper. The 3D view brings its own lighting.
- **Colour.**
  - Neutral chrome, with one accent: amber `#f5a524`, the same warm light as
    the 3D "cinema" theme.
  - Loop blue: `#2f86ff`.
  - Parts use the 3D palette: orange, blue, pink, teal, yellow, violet.
  - Colour is never decoration.
- **Type.**
  - Chrome uses the system UI font at 13–15 px, with tabular numbers for time and bars.
  - Music text uses the score's own fonts.
- **Icons.** 1.8 px stroke line icons on a 24 px grid, Lucide-like. Text only where
  an icon would be ambiguous: the view names (Page / Wrap / Line / 3D), "Aa", "1×".
- **Shape.** 8–14 px radii. Translucent bars (`backdrop-filter: blur`), solid
  panels. Shadows only on things that float.
- **Density.**
  - The top bar is 52 px and the bottom bar 64 px.
  - Hit targets are at least 36 px (40 px on touch).
  - The time and position text sits beside play, not under it.
- **Motion.**
  - Things appear in 150–250 ms with an ease-out curve. Nothing bounces.
  - The playhead moves continuously, and the page follows by smooth scrolling.
  - `prefers-reduced-motion` turns off the chrome fade and the smooth follow.

## 4. Anatomy

```
Desktop
┌────────────────────────────────────────────────────────────────────────────┐
│ ☰ Notably  We three kings…  Christmas trad.  (For B♭ Clarinet ✕) (Edited·Save)
│                                   [Page|Wrap|Line|3D|▾]  ✎  Aa  ⇪ Share     │ 52px, translucent
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──┐                                                                       │
│ │↖ │ edit tool rail (only in Edit): Select · Write by hand · Text · Erase  │
│                    ┌───────────────── paper ─────────────────┐   ┌───────┐ │
│                    │  title (click to edit)                  │   │ Parts │ │ panels slide in
│                    │  ▓▓ current bar  ┃ playhead               │   │  ...  │ │ from the right,
│                    │  ░░ loop region (blue)                   │   └───────┘ │ one at a time
│                    └─────────────────────────────────────────┘             │
│                         ( ↓ Back to the playhead )                         │ only after manual scroll
│                    ┌──── piano keyboard (P) ────┐                          │ floats above the bar
│ ═══Verse═══════════●══════════════╪════Chorus══════════════════════════════│ scrub: sections = chapters
│ (▶) ⏮  0:12 / 0:34 │ Bar 12 of 36 · Verse          ⟲  🔊━━  1×  🎹  ⫶⫶  ⚙  ⛶ │ 64px
└────────────────────────────────────────────────────────────────────────────┘

Phone (< 720px)
┌──────────────────────────┐
│ ☰  We three kings…  Aa ⇪ │  view switch lives in Aa
│                          │
│   score, re-flowed to    │  wrap layout at phone width
│   the screen width       │
│                          │
│ ════════●═══════╪═══════ │
│ (▶) 0:12 / 0:34    1×  ⋯ │  ⋯ = loop, keyboard, parts, playback settings
└──────────────────────────┘  panels become bottom sheets
```

**Top bar: what you're looking at, and how.**
- **Menu (☰):** Open, Samples, Recent, Save, Save as (.nwctxt, .nwc, MusicXML),
  Export PDF, Copy link, Theme, Shortcuts, About this score. The copyright text
  moves from the footer to "About this score".
- **Title and composer:** click the title to rename it. It is the same field as
  the title on the page.
- **Status chips:** situational state that you can click and dismiss ✕, for
  example "For B♭ Clarinet", "Scanned page · 3 to check" or "Looping 12–16". The
  **Edited · Save** pill is the same idea, shown only when there are changes.
- **View:** Page · Wrap · Line · 3D, then **▾ More views**. The overflow holds
  views that only some scores have (the scanned photo) or that are used less
  (piano roll, falling notes). "Line" is today's Scroll; the new name says what
  you get.
- **✎ Edit (E):** turns on edit mode and its tool rail. In read mode, nothing on
  the page changes the score.
- **Aa (Appearance panel):** zoom and fit, music font, staff size, theme, then
  collapsed groups for Print look, Spacing, Page and Advanced. While in 3D, the
  3D options appear here too.
- **Share:** copies a link at the current bar and loop. A long press, or the
  arrow beside it, offers PDF and file formats.

**Bottom bar: playback.**
- **Left:** play/pause as a filled circle, back to start, time / duration, and
  "Bar 12 of 36 · Chorus".
- **Scrub bar:**
  - spans the full width, on the bar's top edge
  - split into chapters at sections: rehearsal marks, text such as "CHORUS", repeats
  - thickens on hover
  - shows faint bar ticks
  - hover preview: "Chorus · Bar 24 · 0:22"
  - the loop region is drawn on it
- **Right:**
  - loop
  - volume: the slider opens on hover or focus, or on tap on touch
  - speed chip: amber when not 1×
  - piano keyboard
  - parts
  - playback settings ⚙: follow mode, count-in, metronome, play repeats,
    highlight style, sound, shortcuts
  - fullscreen

## 5. Interaction details

**Follow.**
- The modes are *Keep near the top* (default), *Keep in the middle*,
  *Only when needed* and *Off*, as in Soundslice.
- A wheel, drag or touch scroll pauses following and shows the "Back to the
  playhead" pill.
- In Page view, following turns pages instead of scrolling. Page buttons sit in
  the margins and hide during playback. Two pages are shown side by side on
  screens 1500 px or wider.

**Seek.**
- Click a note or bar on the score: the playhead jumps there, and playback
  carries on if it was playing.
- While paused, clicking shows a small context bar: **▶ Play from here · ⟲ Loop
  bars · ✎ Edit**.
- On the scrub bar, drag to seek and click a chapter to jump to it.

**Loop.**
- Drag across bars on the score; the loop snaps to barlines. Or press R to loop
  4 bars from the playhead.
- The loop shows on the score and on the scrub bar.
- A small loop menu appears and hides during playback. It holds Count-in, Clear
  and, later, *Speed trainer*: each pass is a little faster, a well-loved
  Soundslice feature (<https://www.soundslice.com/help/en/player/basic/286/speed-training/>).

**Speed.**
- The chip shows `1×`.
- The popover has presets (0.5×, 0.75×, 1×, 1.25×), a slider from 0.25 to 2×,
  and the tempo as BPM: "♩ 78 (written 104)".
- Shift+< and Shift+> step it by 0.25×.
- It is remembered per score.

**Volume.** There is a master volume and a mute (M). Volume is remembered. ↑/↓ stay scroll keys: in a reader, scrolling the page matters more than YouTube's volume keys.
Each part's level is in the Parts panel.

**Parts.**
- One row per staff (or per layered pair), with:
  - a colour swatch
  - the name and instrument
  - **M**ute, **S**olo, a volume slider, and a 👁 eye that hides the staff from view
- This replaces the "Solo staff" select. It is a light panel, not a DAW mixer.
  musescore.com puts its advanced mixer behind PRO; Notably keeps the whole
  player free.

**Edit, kept light and on purpose.**

There are two ways in: **✎ Edit (E)** in the top bar, or **✎ Edit** in the click
context bar. Double-click and Enter also work. Edit mode slides in a tool rail on
the left:
- **Select:** click to pick a note and get the note bar.
- **Write by hand:** pen, finger or mouse on the staff (StaffInk, see §6).
- **Text**
- **Erase**

The transport stays available, so you can play while editing.

1. Select a note.
2. A floating note bar appears. Its keys:
   - durations 1 2 4 8 6
   - flat −, natural =, sharp +
   - dot `.`, tie T
   - Delete
   - ↑/↓ for pitch
3. Done or Esc ends editing.

The title, author and lyricist are edited in place, as today. The editing keys
only work while editing.

**Go to (later).** `/` opens a small command field: "b32" goes to bar 32,
"chorus" to a section, "speed 80" sets the speed, "font leland" changes the
font. It is shown as a search icon so it isn't hidden; Dorico's Jump bar is
"annoyingly hard to find", in its own product lead's words
(<https://www.scoringnotes.com/news/namm-2026-john-barron-dorico/>).

**Keyboard.** YouTube's keys wherever they fit, bars wherever music needs them.

| Key | Action | Why |
|-----|--------|-----|
| Space, K | Play / pause | YouTube |
| ← / → | Previous / next bar | YouTube's ±5 s, in bars |
| J / L, Shift+← / → | Back / ahead 5 bars | YouTube's ±10 s, in bars |
| Home or 0, 1–9 | Start, jump to 10–90% | YouTube |
| Shift+< / > | Slower / faster | YouTube, Soundslice |
| M | Mute | YouTube (↑ / ↓ keep scrolling the score) |
| F | Fullscreen | YouTube |
| R | Loop on / off | **R**epeat. L is kept for YouTube's "ahead" |
| P | Piano keyboard | MuseScore |
| X | Parts | |
| PgUp / PgDn | Previous / next page or system | page-turn pedals |
| Alt+1–4 | Page / Wrap / Line / 3D | |
| / | Go to bar or command | |
| E | Edit on / off | |
| I | Write by hand (in Edit) | **I**nk |
| ? | Shortcut sheet | YouTube |
| Esc | Close the panel, leave edit, clear the selection | |

## 6. Built to grow: the slots

Notably will keep gaining capabilities that are bigger than a setting: handwriting
input (StaffInk), photo and PDF scores with transposition (ScoreShift), and more
visualisers. Each one has to find a home **without adding a permanent button**.
The frame therefore has a fixed set of slots, and every capability declares
which slots it fills.

| Slot | Where it lives | What goes in it | Today | Future |
|------|----------------|-----------------|-------|--------|
| **Source** | Start sheet (☰ → New / Open, empty state, drop anywhere) | ways a score gets in: one card each | Open file, Samples, Link | **Scan a page** (ScoreShift), **Write by hand** (StaffInk), Import from URL |
| **View** | Top bar switch; less common ones in ▾ More views | ways to look at the same score | Page, Wrap, Line, 3D | **Photo of the page** (ScoreShift, scanned scores only), Piano roll, Falling notes (midiviz) |
| **Tool** | Edit rail (Edit mode only) | what your pointer or pen does to the score | Select (title) | Select + note bar, **Write by hand** (StaffInk), Text, Erase |
| **Transform** | ☰ → Score, plus a status chip while active | a derived version of the score, reversible | — | **Transpose for an instrument** (ScoreShift), Concert/written pitch, Extract a part |
| **Panel** | Right side, one at a time; opened by its button, chip or command | inspectors and long forms | Parts, Appearance | **Transpose**, **Recognition review** (ScoreShift corrections), Lyrics |
| **Dock** | Floating strip above the transport, one at a time | live companions to playback or input | Piano keyboard | **Ink alternatives strip** (StaffInk), Fretboard, Loop menu |
| **Status chip** | Next to the title | situational state you can click or dismiss | Edited · Save | "For B♭ Clarinet ✕", "Scanned · 3 to check", "Looping 12–16" |
| **Export** | Share ▾ and ☰ → Save as | output formats | nwctxt, nwc, MusicXML, PDF | MIDI, PNG, **transposed PDF** (ScoreShift) |
| **Command** | `/` palette and the `?` sheet | every action, with a name and an optional key | — | every feature registers its commands |

### Rules for anything new

1. **Pick slots; never add a toolbar button.** The top and bottom bars are a
   closed set. A feature earns a permanent button only by becoming a
   top-two job (§1).
2. **Show up only while it applies.** Use a status chip, a "More views" entry
   that is enabled only for scanned scores, or a dock strip only in Ink.
3. **Always reachable by name.** Register commands for `/`.
4. **Share the primitives.** Use one note bar, one selection, one playhead and
   highlight contract, one parts colour palette, one export list. StaffInk's
   note edit bar and Notably's become the same component.
5. **Phones too.** Panels become bottom sheets, the dock shrinks to a strip, the
   rail becomes a row above the transport, and the transport collapses to
   ▶ + time while you edit.

### StaffInk in Notably

| Slot | Fill |
|------|------|
| Source | **Write by hand**: a blank staff with clef, key and time, which opens straight into Edit with the pen tool |
| Tool | **Write by hand (I)** on any score: write into an existing bar. A stylus picks the pen by itself, and a finger still scrolls |
| Dock | The **alternatives strip** ("Recognised as ♩ ♪ 𝄽 ♯"). Tapping one corrects the symbol and teaches the recognizer |
| Note bar | StaffInk's duration, dot, accidental, articulation and dynamics bar *is* the Select tool's note bar |
| Appearance | Handwritten font (Petaluma) is already a music-font choice; there are no new controls |
| Data | Ink is turned into Notably tokens (or MusicXML) and engraved by Notably, so every view, playback and export works unchanged |

### ScoreShift in Notably

| Slot | Fill |
|------|------|
| Source | **Scan a page**: camera, image or PDF (page strip). Dropping a photo anywhere goes the same way |
| View | **Photo of the page**: the deskewed photo with the playhead and lit notes drawn *on the photo*. Page, Wrap, Line and 3D show the recognised music engraved by Notably |
| Transform | **Transpose for an instrument**: written for, play on, octave, clef. This works for **every** score, not only scans. While active, a chip shows "For B♭ Clarinet ✕". On the Photo view the page is rewritten in its own ink; elsewhere the engraving is re-laid out |
| Panel | **Recognition review**: low-confidence symbols listed and highlighted, with corrections. It opens from the chip "Scanned · 3 to check" |
| Export | Transposed PDF or image, plus MusicXML and MIDI as written or transposed |

### Contracts behind the slots (for the code)

- **View:** `{ id, label, available(doc), mount(el), unmount(), setTime(t, playing),
  hitTest(x, y) → { bar, note }, follow(t) }`. Page, Wrap and Line are one engraved
  view in three modes. The 3D view already has this shape (`rebuild`, `onTime`,
  `seek`, `show`, `hide`). Photo is another implementation.
- **Document:** `{ source, data, edits, transforms[] }`. Edits are today's drafts.
  Transforms are reversible and render as chips. Every view reads the transformed data.
- **Registry:** sources, views, tools, panels, dock items, exports and commands
  register `{ id, label, icon, key?, available?(doc) }`. The bars, menu, start
  sheet and `/` are built from it, so a new capability is a new module, not
  edits all over `index.html`.

## 7. Where today's controls go

| Today | New home |
|-------|----------|
| Open, sample select | ☰ Menu → Open / Samples / Recent; the title shows in the top bar |
| Save ▾ (nwctxt / nwc / MusicXML / PDF) | ☰ Menu → Save / Save as / Export PDF; also under the Share arrow |
| Share | Top bar **Share** (link at the bar, loop and view) |
| Play / Stop text buttons | ▶ / ⏸ in the bottom bar; back to start ⏮ (Stop = pause + start) |
| Time + 160 px progress | Time + Bar · section, full-width chapter scrub bar |
| Scroll / Wrap / Page / 3D | Top bar view switch (Scroll is renamed Line) |
| Zoom slider, W, H | Aa → Zoom (−, %, +, Fit width or height), Ctrl/Cmd +/−, pinch |
| Page prev / next / input | Page view margin buttons, PgUp/PgDn, `/` "p3" |
| Settings → Speed | Speed chip `1×` |
| Settings → Solo staff | Parts panel (M / S / volume / eye) |
| Settings → Highlight mode, Auto-scroll | ⚙ Playback → Highlight, Follow mode |
| Settings → Piano keyboard | 🎹 button / P |
| Settings → 3D view | Aa panel while in 3D |
| Settings → Page, Engraving, Print look, Spacing | Aa panel, in collapsed groups |
| Settings → Import & tools, Advanced | Aa → Advanced; the converter link moves to ☰ Menu |
| Unsaved changes status | **Edited · Save** pill |
| Footer copyright | ☰ → About this score (and the end of the score) |
| *(missing)* Volume | 🔊 + slider, M |
| *(missing)* Loop, count-in, metronome | ⟲ / R / drag on the score; ⚙ Playback |

## 8. What we won't do

- Ribbons or an always-on toolbar with everything at the same weight. Sibelius
  7's ribbon "met with considerable user resistance"
  (<https://en.wikipedia.org/wiki/Sibelius_(scorewriter)>).
- Overlays that cover notes during playback. Menus and popovers close or fade
  when play starts.
- Auto-scroll that fights the reader.
- Controls that only work on hover.
- Modes you can't see, where a stray key edits the score.
- Power features with no signpost.
- Paywall-style "pro" tiers on basics such as the mixer, loop or speed.

## 9. Rollout

Each step ships on its own and removes nothing.

1. **Transport: done.**
   - Bottom bar (`src/transport.js`): play/pause, back to start, time and
     "Bar 12 of 36 · Chorus", a scrub bar split into sections.
   - Sections are worked out in `src/transport-timeline.js`: double and repeat
     barlines plus each repeat pass, named from bold or all-caps staff text.
   - Volume in `PlaybackController`, sent as CC 7 because OxiSynth owns its
     audio graph.
   - Speed chip with presets, a slider, an exact value and the tempo as BPM.
   - Keyboard map in `src/commands.js`, with the `?` sheet built from it.
   - The bar fades while playing.
   - Follow pill.
   - Fixed: Play after Pause restarted from the top, and seeking before the
     first Play was ignored.

   Play, Stop, progress, speed and the piano toggle left the top toolbar and
   Settings.
2. **Top bar, panels and the registry.**
   - ☰ menu drawer and Start sheet.
   - Title, composer and status chips in the bar.
   - View switch with ▾ More (Scroll renamed Line).
   - Share.
   - The Settings popover becomes the Aa panel with collapsed groups.
   - The footer moves to About.
   - Studio and Light themes.

   The bars, menu, start sheet and panels are built from the §6 registry from
   the start, so later steps only register things.
3. **Parts panel.** Mute, solo, volume and eye per staff. One shared palette for
   the parts, the piano keys, the 3D lights and the highlights.
4. **Practice.**
   - Loop: R, drag on the score, shown on the scrub bar.
   - Count-in and metronome.
   - Follow modes.
   - Per-score memory of speed and loop.
   - Share links that carry the bar and loop.
5. **Score as interface.** Click-to-seek context bar, then Edit mode with the
   tool rail (Select and its note bar, Text, Erase) and explicit E / Esc.
6. **Touch and page performance.**
   - Phone layout and bottom sheets.
   - Tap to show chrome.
   - Page margins, two-up and pedals.
7. **Go to / command palette.** `/`.
8. **Plug-ins from the sketches**, each its own module filling §6 slots:
   - StaffInk: the Write by hand source and tool, plus the alternatives strip in the dock.
   - ScoreShift: the Scan a page source, the Photo view, the Transpose transform
     and panel, and Recognition review.

## Sources (research summary)

- **Dorico:**
  - modes and zones:
    <https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/user_interface/user_interface_zones_hiding_showing_t.html>
  - transport:
    <https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/user_interface/user_interface_transport_options_r.html>
  - Jump bar:
    <https://www.steinberg.help/r/dorico-pro/5.1/en/dorico/topics/user_interface/user_interface_jump_bar_r.html>
- **MuseScore 4:**
  - playback controls: <https://handbook.musescore.org/sound-and-playback/playback-controls>
  - shortcuts: <https://handbook.musescore.org/basics/default-keyboard-shortcuts.md>
  - musescore.com player: <https://help.musescore.com/en/articles/8535930-listen-and-view>
- **Flat:**
  - loop: <https://blog.flat.io/loop-mode-flat/>
  - sidebar and quick search: <https://blog.flat.io/new-flat-for-education-editor-sidebar/>
- **Soundslice:**
  - keyboard shortcuts: <https://www.soundslice.com/help/en/player/tips/1/keyboard-shortcuts/>
  - layouts: <https://www.soundslice.com/help/en/player/advanced/241/scrollable-vs-paged-layout/>
- **forScore:** <https://forscore.co/documentation/basics/>
- **YouTube:**
  - shortcuts: <https://support.google.com/youtube/answer/7631406>
  - chapters: <https://support.google.com/youtube/answer/9884579>

  The hover-reveal volume slider is observed behaviour, not documented.
- **Noteflight:** <https://www.noteflight.com/>, plus the Scoring Notes coverage
  linked above. Its help centre was not reachable, so its player details are not
  verified.
