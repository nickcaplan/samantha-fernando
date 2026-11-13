# Samantha Fernando Website Content Record

This file is the complete content inventory for the static site. Biography and Works & Media are managed in Sanity and rendered into static pages at build time. Keep this record aligned with published CMS content and committed fallbacks rather than treating `index.html` as the editorial content store.

Copy conventions: use British English and ordinary ASCII hyphens for prose dashes, not en dashes or em dashes (confirmed 31 October 2026). Do not use Oxford commas.

## Site Metadata

- Site title: Samantha Fernando - Composer
- Site type: Composer portfolio
- Canonical URL: https://www.samanthafernando.com/
- Meta description: Official website of British composer Samantha Fernando. Explore her compositions, recordings, films, writing and score-hire information.
- Social image: `assets/sam-1-1200.webp`, Samantha Fernando portrait
- Structured data: consistent `Person` identity across pages, page-specific `WebPage`/`AboutPage`/`ContactPage`, composition `ItemList` on Works and `Article` on the full essay. Official profiles are SoundCloud, Spotify, Instagram and NMC.
- Primary navigation: Home, Works, Listen, Watch, Biography, Writing, Contact
- Header label: Samantha Fernando
- Header descriptor: Composer
- Hero quote: "Creating a space in sound that an audience can enter and inhabit."
- Audio control label: Listen
- Audio control tooltip: Listen to Samantha's music
- Default audio track: Everything Passes, Everything is Connected - The Crossing (Spotify preview). The catalogue Settings singleton selects a published Recording from either audio provider; with no default selected, the header Listen control opens the catalogue instead.
- Footer copyright: © Samantha Fernando. All rights reserved.
- Analytics: Google Analytics 4 uses Measurement ID `G-N74SECKP5X`. The tag loads only after a visitor accepts analytics cookies. Visitors can reject analytics or revisit the choice through the footer's Cookie preferences control.

### Page Search And Social Metadata

All page paths use `https://www.samanthafernando.com` as their canonical origin and share the portrait social image above. Social titles and descriptions match each page's search metadata.

| Path | Title | Description |
|---|---|---|
| `/` | Samantha Fernando - Composer | Official website of British composer Samantha Fernando. Explore her compositions, recordings, films, writing and score-hire information. |
| `/biography/` | Biography \| Samantha Fernando | About British composer Samantha Fernando: her artistic practice, collaborations, selected milestones, education and fellowship. |
| `/works/` | Works & Media \| Samantha Fernando | Explore compositions by Samantha Fernando, with instrumentation, commissions, premiere details, recordings and performance films. |
| `/listen/` | Listen \| Samantha Fernando | Listen to recordings of compositions by Samantha Fernando, published across SoundCloud and Spotify. |
| `/watch/` | Watch \| Samantha Fernando | Performance films and composer features by Samantha Fernando. |
| `/writing/` | Writing \| Samantha Fernando | Essays by composer Samantha Fernando on creative process, composition and artistic philosophy. |
| `/contact/` | Contact & Score Hire \| Samantha Fernando | Contact Samantha Fernando about commissions, score hire, performance materials, performance notifications and academic enquiries. |

Listen and Watch are standalone pages at `/listen/` and `/watch/` sharing the Works & Media catalogue with the recording or film view preselected. Search and instrumentation filters do not create separate pages.

### Page Not Found

- Output: `/404.html`, served for unknown URLs with HTTP 404 by GitHub Pages and the local preview server. Excluded from the sitemap, with `noindex, follow` and no canonical URL or structured data.
- Title: Page not found | Samantha Fernando
- Meta description: The page you’re looking for isn’t here. Return home or explore recordings by Samantha Fernando.
- Label: 404 · Page not found
- Heading: An unexpected pause.
- Copy: The page you’re looking for isn’t here. There’s still plenty to discover.
- Illustration: a whole rest hanging beneath the fourth line of a continuous five-line stave; decorative, not announced by screen readers.
- Primary link: Back to home → `/`
- Secondary link: Explore recordings → `/listen/`
- Uses the existing site header, theme toggle, navigation, audio shell, cookie controls and footer.

## Biography Page

**Source of truth: Sanity.** The Biography is managed in the `biographyPage` singleton in Sanity project `9a66iw1t` (dataset `production`) and rendered into `/biography/` at build time using the shared source template in `index.html`. The copy below is the seeded content and the committed fallback; after the first edit in Sanity, the Studio is canonical and this section should be kept in step with it.

Biography is the `/biography/` page, opened by the `Biography` navigation item. The heading is followed by the birth-year line "b. 1984". On mobile, a circular portrait breaks up the opening copy; larger screens retain the supporting portrait alongside the profile, milestones, education and fellowship.

### Artistic Philosophy & Biography

In recent years, her music has moved towards a language that values clarity, directness, and openness: working with deliberately limited material, allowing music time to breathe, and attending with precision to gesture, texture, and form.

Collaboration with performers is central to her practice, particularly in shaping sound worlds that respond to the physicality of instruments and the acoustic space in which music is heard.

Samantha has worked with numerous world-leading ensembles including the Philharmonia Orchestra, London Sinfonietta, BCMG, Riot Ensemble, The BBC Singers, LOD Muziektheater (Ghent), Silbersee Vocal Ensemble (Amsterdam), and The Crossing (USA). Her music has been performed at major international festivals including Aldeburgh Music, Huddersfield Contemporary Music Festival, Sounds New, Gaudeamus Muziekweek, York Late Music, and the Oxford Lieder Festival.

Samantha studied Composition at the Royal Academy of Music and the University of Oxford. She holds a PhD in Composition. She is an Honorary Research Fellow in Composition at Royal Holloway, University of London.

In 2021, Samantha saw the opening of Current, Rising, a world-first hyper-reality opera experience produced by the Royal Opera House and Figment Productions. Her chamber opera glass human, created in collaboration with Melanie Wilson, premiered at Glyndebourne in Autumn 2022. Recent commissions include Sound Inhabitants for the London Sinfonietta and Wintering, commissioned by Wigmore Hall and performed by Manchester Collective and The Marian Consort.

- Contact call to action: Discuss a commission or performance. Opens Contact & Score Hire.

### Education and Fellowship

- Education: Royal Academy of Music and University of Oxford
- Fellowship: Honorary Research Fellow in Composition at Royal Holloway, University of London

### Key Highlights

- 2025 - Exoplanets: TRAPPIST-1e (from The Exoplanets): City of London Sinfonia and curious directive co-commission, premiered at Norwich Theatre Royal.
- 2025 - Wintering: Commissioned by Wigmore Hall with Manchester Collective & The Marian Consort.
- 2023 - Sound Inhabitants: 15 players commission premiered by London Sinfonietta at Southbank Centre.
- 2022 - glass human: Chamber opera premiered at Glyndebourne & UK national tour.
- 2021 - Current, Rising: Hyper-reality opera experience at the Royal Opera House, London.
- 2013 - RPS Composition Prize: Royal Philharmonic Society award & Philharmonia commission.

### Home Page Heading

- Name line: Samantha Fernando (no trailing comma).
- Subtitle on the next line: British Composer.

### Home Page Calls To Action

- Explore Works: Works
- Listen: Listen
- Get in Touch: Contact & Score Hire

## Events

### Upcoming performances

- 20 February 2027 - Formations. The Tung Auditorium, Liverpool. Ensemble 10:10. Event: https://www.liverpoolphil.com/events/reinventing-beethoven/
- 23 February 2027 - New work for Fretwork and Ruby Hughes. Skipton Town Hall, Skipton. Skipton Music Festival. More dates to follow. Event: https://www.fretwork.co.uk/concerts-1/uojmskjcgfpkus2t8jr8lvdfwppoj5
- May 2027 - New work for The Marian Consort. More details to follow soon.

### Past performances

- 24 October 2026 - Balconies. YST Cube (Level 3), Yong Siew Toh Conservatory of Music, Singapore. Performed by Olivia de Prato. Event: https://www.performerspresent.com/programme/plenary-motherhood-artistry
- 16 October 2026 - Kinesphere. Conway Hall, London. Performed by Sinead Walsh. Bloomsbury Festival. Event: https://www.empowerwomenchangingmusic.com/events/empower-at-bloomsbury-festival-double-bill-soraya-verjee-and-no-more-girl-friday
- 13 March 2026 - The Exoplanets. Hackney Empire, London. City of London Sinfonia, conducted by Micah Gleason.
- 5 December 2025 - Wintering. Bristol Beacon, Bristol. Manchester Collective.
- 3 December 2025 - Wintering. Sir Jack Lyons, York. Manchester Collective.
- 29 November 2025 - Wintering. Tung Auditorium, Liverpool. Manchester Collective.
- 28 November 2025 - Wintering. Howard Assembly Room, Leeds. Manchester Collective.
- 27 November 2025 - Wintering. Stoller Hall, Manchester. Manchester Collective.
- 22 November 2025 - Wintering (World premiere). Wigmore Hall, London. Manchester Collective & The Marian Consort.
- 6-7 September 2025 - The Exoplanets (World premiere). Norwich Theatre Royal, Norwich. City of London Sinfonia, conducted by Naomi Woo.
- 2 February 2025 - Fault Line. Turner Sims, Southampton. Tim Gill, London Sinfonietta.

The homepage section is present only while upcoming performances exist. Past performances are collapsed by default. Published Sanity Performance documents are the editing source; `content/performances.json` is the committed fallback. May 2027 uses 1-31 May sorting bounds, not confirmed performance dates. Displayed past-work groups run most recent stop first; each stop remains an individual editable record. Location and per-performance World premiere metadata are optional.

## Featured Operas & Major Projects

This Spotlight Works section appears beneath the homepage hero. The full biography is presented separately at `/biography/`.

### Wintering

- Label: Wigmore Hall Commission (2025)
- Instrumentation: SATB Chorus + String Quartet
- Duration: 27 mins
- Description: Inspired by Katherine May's book. Performed by Manchester Collective and The Marian Consort, exploring human retreat, quiet introspection, and seasonal cycles.
- Movements: I. Vista; II. Cloud Canvas 1; III. Cloud Canvas 2; IV. To Do: Do Less; V. Snow on Snow; VI. Cocoon

### glass human

- Label: Glyndebourne Opera (2022)
- Instrumentation: 3 Singers, 5 Players & Electronics
- Duration: 50 mins
- Description: Chamber opera created with librettist Melanie Wilson for Glyndebourne. Three isolated voices find their way towards each other, charting a journey from loneliness to connection.
- Creative team: Libretto Melanie Wilson; Director Lucy Bailey; Cast Anna Cavaliero, Camille Maalawy, Denver Martin Smith

### Current, Rising

- Label: Royal Opera House (2021)
- Instrumentation: Soprano, ensemble, electronics
- Duration: 15 mins
- Description: World-first hyper-reality opera produced by ROH & Figment Productions. Blending stagecraft with CG technology, placing the audience at the center of the performance.
- Creative team: Director Netia Jones; Soprano Anna Dennis; Ensemble CHROMA; CGI Figment Productions

## Works List

The 23 entries below are the current committed fallback and Sanity import source. After activation, each is a `work` document; Recordings and Films reference it explicitly. Empty optional cells mean no value is currently displayed. The view sorts newest first, then alphabetically. Existing uncertain metadata is preserved pending the questions in `docs/questions-for-sam.md`.

| Title | Year | Category | Duration | Instrumentation | Commission | Premiere | Notes |
|---|---|---|---|---|---|---|---|
| Balconies | 2023 | Solo & Chamber | 8 mins | Solo violin (multi-tracked or ensemble of 5 violins) | Olivia de Prato, for the Panorama album | | New Focus Recordings (2023) |
| 4 Klee Miniatures | 2021 | Solo & Chamber | 6 mins | Solo horn | Deepa Goonetilleke | | |
| The Way Home | 2018 | Vocal & Choral | 9 mins | Soprano, cello & piano | Kettle's Yard | June 2018 | |
| Fault-Line | 2015 | Solo & Chamber | 6 mins | Solo cello | London Sinfonietta | Peckham Asylum (June 2015) | |
| Kinesphere | 2013 | Solo & Chamber | 6 mins | Solo flute | London Sinfonietta | Purcell Room | Released on NMC Recordings |
| 4 Illuminations | 2012 | Solo & Chamber | 8 mins | Saxophone quartet | | Royaumont Abbey, France, by the Xasax Quartet | |
| Sissay Settings | 2016 | Vocal & Choral | 7 mins | Soprano and piano | York Late Music | | Settings of poetry by Lemn Sissay |
| Look Up | 2014 | Vocal & Choral | 12 mins | 4 voices, bass viol & electronics | LOD Music Theatre & Silbersee vocal ensemble (Ghent) | | |
| Ganymede | 2014 | Vocal & Choral | 5 mins | Tenor and piano | Oxford Lieder Festival | | Associated venue: Holywell Music Room |
| 3 Songs for Soprano and Cello | 2014 | Vocal & Choral | 11 mins | Soprano and cello | | | Recorded and released by Riot Ensemble (Sarah Dacey & Louise McMonagle, 2020) |
| Square of Light | 2013 | Vocal & Choral | 4 mins | Soprano and piano | | | Chamber vocal settings |
| Wintering | 2025 | Large Ensemble | 27 mins | SATB + string quartet | Wigmore Hall | Manchester Collective & The Marian Consort | |
| Sound Inhabitants | 2023 | Large Ensemble | 12 mins | 15 players (fl, cl, ob, bsn, hn, tpt, trb, perc, hp, pno, 2vlns, vla, vc, db) | London Sinfonietta | Purcell Room, Southbank Centre | |
| Breathing Forest | 2022 | Large Ensemble | 15 mins | Solo soprano, strings and percussion | Birmingham Contemporary Music Group (BCMG) & Anna Dennis | | |
| Formations | 2018 | Large Ensemble | 10 mins | 15 players | London Sinfonietta 50th anniversary | Royal Festival Hall, conducted by Vladimir Jurowski | |
| Positive/Negative Space | 2013 | Large Ensemble | 8 mins | Flute, clarinet, alto saxophone & cello | | London Sinfonietta at Purcell Room, Southbank Centre | RPS Composition Prize commission |
| glass human | 2022 | Opera & Stage | 50 mins | 3 singers, 5 players & electronics | Glyndebourne | Glyndebourne | Chamber opera created with Melanie Wilson |
| Current, Rising | 2021 | Opera & Stage | 15 mins | Soprano, ensemble, electronics | Royal Opera House & Figment Productions | | Hyper-reality opera experience |
| Everything Passes, Everything is Connected | 2021 | Vocal & Choral | 7 mins | Unaccompanied choir | The Crossing (USA) | The Crossing (USA) | |
| Have It All | 2020 | Vocal & Choral | 6 mins | Unaccompanied choir | BBC Singers | | Broadcast on BBC Radio 3 |
| Exoplanets: TRAPPIST-1e | 2025 | Orchestral | 5 mins | Orchestra | City of London Sinfonia and curious directive | Norwich Theatre Royal, 2025 (Naomi Woo). Hackney Empire, 2026 (Micah Gleason) | |
| Breathing Space | 2019 | Orchestral | 12 mins | Symphony orchestra | Philharmonia Orchestra | | Conducted by Martyn Brabbins |
| Echo of a Woman | 2018 | Orchestral | 14 mins | Soprano and orchestra | Royal Holloway University Symphony Orchestra | | |

Additional supplied Exoplanets context, not currently shown on the compact card: part of a 95-minute continuous suite, one of seven movements with planetarium visuals and science commentary; associated partners Norwich Theatre and Norfolk and Suffolk Music Hub. World premiere 6-7 September 2025; London premiere 13 March 2026. Inspired by the rocky exoplanet TRAPPIST-1e and its habitable zone.

### Works Card Standard

Each Works card uses the same fields: year, controlled category, duration, title, instrumentation, commission, premiere and optional notes. The category is the only pill shown on the card; venues, ensembles, awards and recording labels belong in the relevant metadata field instead. Works with hosted audio or video have consistent fine-outline media actions, stacked vertically when there is more than one. Each uses a play icon and a specific label such as `Listen`, `Trailer`, `Performance excerpt`, `Insights` or `Watch`; works without hosted media have no row action.

Media actions use explicit related-Work references, including the three tracks from 3 Songs for Soprano and Cello. Editors can set their order within a Work; Listen and Watch remain newest-first catalogue views. Composition structured data is generated from the same published Work records during the content build.

## Watch

- Standalone `/watch/` page sharing the Works & Media catalogue, film view preselected. The committed fallback and import contain eleven films.
- The Exoplanets: Samantha Fernando introduces TRAPPIST-1e. Related work: Exoplanets: TRAPPIST-1e. Label: The Exoplanets (2025). Description: Samantha Fernando introduces her movement inspired by the rocky exoplanet TRAPPIST-1e. Link: https://www.youtube.com/watch?v=PtuinjIcJD0
- Current, Rising: The World's First Hyper-Reality Opera. Action label: Trailer. Label: Royal Ballet and Opera (2020). Duration: 0:50. Description: Trailer for a 15-minute hyper-reality opera combining virtual reality with a multisensory set. Music is composed by Samantha Fernando, directed by Netia Jones, with libretto by Melanie Wilson and vocals by Anna Dennis. Link: https://www.youtube.com/watch?v=KXrYuIWLv60
- Trailer: Current, Rising - The World's First Hyper-Reality Opera. Action label: Trailer. Related work: Current, Rising. Label: Royal Opera House (2021). Published 6 May 2021. Description: Official trailer for the hyper-reality opera composed by Samantha Fernando with libretto by Melanie Wilson. Link: https://www.youtube.com/watch?v=eY0GioXHBL4
- How Was the World's First Hyper-Reality Opera Created?. Related work: Current, Rising. Label: Royal Ballet and Opera (2020). Duration: 33:35. Description: Insights panel discussing the development and technology behind Current, Rising, featuring Samantha Fernando and the creative team. Link: https://www.youtube.com/watch?v=AVXYPqdAYdY
- Wintering (Trailer). Action label: Trailer. Related work: Wintering. Label: Manchester Collective (2025). Duration: 2:26. Description: Preview trailer for Wintering for four vocalists and string quartet, presented by Manchester Collective and The Marian Consort. Link: https://www.youtube.com/watch?v=5BApW0VSCes
- Sound Inhabitants. Label: London Sinfonietta (2024). Duration: 15:11. Description: Full performance recording for large ensemble, commissioned and premiered by the London Sinfonietta. Link: https://www.youtube.com/watch?v=hirZmf8DoA4
- How Many Moments Must - Samantha Fernando. Label: Riot Ensemble / Coviello Contemporary (2020). Published 6 February 2020. Description: Performance recording for voice and ensemble, setting text by e.e. cummings. Link: https://www.youtube.com/watch?v=XWvcaMTD9M4
- Fault Line for Solo Cello. Related work: Fault-Line. Label: Louise McMonagle (2022). Duration: 6:06. Description: Performance of a solo cello piece originally commissioned by the London Sinfonietta. Link: https://www.youtube.com/watch?v=k3jRJHzIu4Q
- Charlotte Ashton Performs Samantha Fernando 'Kinesphere'. Related work: Kinesphere. Label: Hebrides Ensemble (2022). Published 8 March 2022. Description: Solo flute performance by Charlotte Ashton, filmed by Flux Video. Link: https://www.youtube.com/watch?v=iDo-EkKhbl4
- Samantha Fernando: Four Klee Miniatures, Horn Solo. Related work: 4 Klee Miniatures. Label: Trio Radial (2021). Published 9 December 2021. Description: Solo horn performance of four miniatures inspired by Paul Klee. Link: https://www.youtube.com/watch?v=x2q25aBh48Y
- Look Up. Related work: Look Up. Label: enoa community (2015). Duration: 8:27. Description: Final concert recording from the European Network of Opera Academies workshop exploring vocal textures and electronic processing. Link: https://www.youtube.com/watch?v=b_w_uYmFwZ4

## Listen

- Standalone `/listen/` page sharing the Works & Media catalogue, recording view preselected. The catalogue contains thirteen recordings. Cards show the related Work's category pill and the track time when known. Spotify actions read `Preview`; SoundCloud actions read `Listen`.

### SoundCloud Tracks

- 4 Illuminations - Xasax Saxophone Quartet at Royaumont Abbey - 8:08 - https://api.soundcloud.com/tracks/105152235
- Fault-Line - Oliver Coates, solo cello / London Sinfonietta commission - 6:03 - https://api.soundcloud.com/tracks/236811796
- Kinesphere (Listen year 2014) - Michael Cox, solo flute, NMC Recordings - displayed duration 4:49 - https://api.soundcloud.com/tracks/332996028. Provider/details/duration require confirmation; see `docs/questions-for-sam.md`. The separately supplied public extract URL is https://soundcloud.com/samanthafernando/kinesphere-for-solo-flute-extract (1:06).
- Recollections [year unavailable] - Elsbeth Gerritsen & Eva Reiter - 1:25 - https://api.soundcloud.com/tracks/125817887
- The Journey Between Us - Reflection 1 (2016) (mixed ensemble) - 3:32 - https://api.soundcloud.com/tracks/292087616
- Look Up (2014) (4 voices, viola da gamba and electronics) - 6:53 - https://api.soundcloud.com/tracks/204818278
- Positive/Negative Space (2013) (flute, clarinet, alto sax & cello) - 6:50 - https://api.soundcloud.com/tracks/132165483
- Square Of Light (2013) for Soprano and Piano - 3:15 - https://api.soundcloud.com/tracks/105347231
- SoundCloud profile: https://on.soundcloud.com/Ohbj2UPBnWa5Scw8AB

### Spotify Tracks

- Balconies - Extract - Olivia de Prato, Panorama Album, New Focus Recordings - 6:53 - https://open.spotify.com/track/2wNL47uCuwDpbOqCIpbSTS
- Everything Passes, Everything is Connected - Extract - The Crossing, unaccompanied choir - 3:30 - https://open.spotify.com/track/3YV79qjiJLOgYjjEzTsVEy
- How Many Moments Must (2014) - Extract - 1:10 - https://open.spotify.com/track/3yRPnEWI5IHASxiNNgvyuh
- Utterance (2014) - Extract - 2:46 - https://open.spotify.com/track/5k4j31qldbj9wqg9VBKo01
- The Half Moon (2014) - Extract - 4:11 - https://open.spotify.com/track/1o0qiFnwPPgBA3k6QWVPM8
- Spotify artist profile: https://open.spotify.com/artist/1AOLNCJ11mI6ewx8CZ8gvM

Soundbar label overrides: Balconies uses `Balconies · Olivia de Prato`; Everything Passes, Everything is Connected uses `Everything Passes, Everything is Connected · The Crossing`. Other Spotify recordings use their titles. SoundCloud row playback displays title and performer/details.

### Recording Availability

More tracks are available on Samantha's SoundCloud and Spotify pages. Not all recordings are hosted publicly for rights reasons. Please use the enquiry form to request audio for unreleased works.

### Soundbar Playback And Progress

- The soundbar presents elapsed time and a display-only progress line for all embedded recordings. It does not support seeking.
- SoundCloud progress is retrieved from the Widget API and includes the recording duration.
- Spotify position, duration and pause state come from the player's `playback_update` reports. Do not assume a fixed 30-second duration or manufacture confirmed playback from an elapsed-time timer. Pending, cancellation and unavailable states follow `docs/test-strategy.md`.
- The visual fill moves smoothly between real reports, clamped to duration and re-anchored by the next report. Time labels and accessible values use the reported position; pause, stop and track changes stop the visual advance ([PR #58](https://github.com/nickcaplan/samantha-fernando/pull/58)).
- The header Listen control and soundbar pause control pause or resume the active recording.
- The soundbar has separate restart and stop controls. Stop clears all playback state and hides the soundbar immediately; opening a video does the same before playback begins.

## Works & Media Catalogue

- Navigation labels: Works, Listen and Watch.
- Eyebrow: Compositions & Recordings. Heading: Works & Media.
- Works introductory text: Full repertoire categorised by instrumentation and scale.
- Listen introductory text: Published recordings across SoundCloud and Spotify.
- Watch introductory text: Performance films and composer features.
- Entry model: Works opens All Works at `/works/`. Listen opens the recording catalogue at `/listen/`. Watch opens the film catalogue at `/watch/`.
- Watch content: Actual YouTube videos only. Project-information cards such as glass human and Current, Rising remain in project or biography content.
- Video behaviour: Watch renders editorial YouTube thumbnail cards from `768px` in two columns and from `1280px` in three columns, showing the year without a redundant `Film` label, then opens the existing in-page modal after a user clicks.

## Writing

The `/writing/` page shows the Writing introduction, complete Wintering essay, portrait and related video directly. There is no summary-only overview or separate essay page.

- Page description: Personal essays on creative process, composition, and artistic philosophy.
- Article type: Featured Essay
- Title: On My Creative Process: 1. Wintering
- Date: November 2025
- Image: `assets/sam-3.webp`, portrait of Samantha Fernando.
- Photo credit: Mike Skelton
- Opening paragraph: Why do I write? What makes me start? Sometimes it’s a book, sometimes a painting, a poem, or a place. Reflecting on my practice, I see there is always the impulse to respond to something or somewhere. It is an emotive impulse before it is a musical utterance.
- Paragraph: For this first foray into writing about my process, it makes sense to consider the book Wintering by Katherine May, since the piece it inspired will be premiered in a matter of days by the Manchester Collective and the Marian Consort at the Wigmore Hall.
- Paragraph: Like many, I have always found winter difficult—something to endure. Its approach fills me with foreboding. The lack of sunlight, the cold seeping into my bones, and the threat of illness all contribute to the struggle. I used to try to keep busy in the hope that the weeks would pass more quickly.
- Paragraph: Reading May’s book was something of a revelation; it offered a way of accepting, even embracing, winter. It suggested that constant busyness might not be the answer—that there might be value in stepping back.
- Paragraph: The notion of “wintering” applies not only to the season but to any period in life when rest, repair, and nourishment are needed: grief, illness, or times of transition. May uses examples from nature, how animals hibernate as well as telling her own story of how she wintered through a difficult period of her life. She also references winter rituals and the power they have to provide solidarity and comfort.
- Paragraph: The book is very evocative; the descriptive writing conjures up both external wintery landscapes as well as the complex internal landscapes we create in our minds. It is this sense of landscape that resonated with me on a musical level. I could hear these landscapes.
- Paragraph: It has taken some time to get to this point, but I am finally finding a sense of my creative voice. What it is that I want to explore through sound. I’ve found this through reflecting on my recent work and the patterns that have begun to emerge. Landscape, a sense of place, architecture, these things all feed into my impulse to compose. I am trying to create a place in sound. One that I can invite an audience into.
- Paragraph: This necessitates a musical language that is not overly-complicated but has a certain directness. I try to create space and time to breathe within the music I write. In pursuit of this, I have found the need to strip things back, take things out, linger for longer. My music isn’t minimalist with a capital M but minimal in material, yes. Stripping back has meant that the material I do use is very deliberate and carries more weight. Detail matters enormously and gestures are intentional.
- Paragraph: I’ve realised that uncovering my musical voice requires attentiveness to what I want to hear—not what I think others want to hear. It means letting go of the fear of judgement.
- Paragraph: Most recently I have found inspiration in composers like Jurg Frey, John Luther Adams and Hildegard Von Bingen. Looking far back and not so far back. Wintering is a piece that culminates some of these influences, impulses and my sense of purpose. It isn’t supposed to be a piece that acts as some sort of musical balm but an evocation of both external Winter landscape and the internal psychological landscape that necessitates the need to winter.
- Closing paragraph: I’m still uncovering, still trying to get closer to the compositional ideals I hold in mind. Creation isn’t linear. But in articulating these thoughts now, I’m putting a pin on the map—in the hope that this moment of clarity propels me forward and, more hopefully still, offers you some insight into my music.
- Video below article: Wintering (Trailer), Manchester Collective and The Marian Consort, https://www.youtube.com/watch?v=5BApW0VSCes

## Contact & Score Hire

- Page description: For commissions, score hire inquiries, or performance notifications.
- Contact panel heading: Contact & Score Hire
- Contact panel copy: For compositions, score hire, performance materials or academic research, please use the enquiry form.
- Academic Affiliation: Department of Music, Royal Holloway, University of London
- Score Availability: Performance scores for chamber, orchestral, and opera works are available upon request or via NMC Recordings and the British Music Collection.
- Form heading: Send a Message
- Form fields: Your Name (required), Email Address (required), Inquiry Type, Message (required), and a hidden Formspree `_gotcha` honeypot excluded from visitor interaction.
- Inquiry types: Score Hire / Purchase Request; Composition Commission; Performance Notification; General / Academic Inquiry
- Submit label: Send Inquiry Message
- Success message: Message sent successfully! I will respond shortly.
- Error message: Unable to send your message. Please try again shortly.
- Delivery: The form submits its name, email, inquiry type and message fields to Formspree at `https://formspree.io/f/mlgqqjen` without leaving the site.

## Privacy Page

- Page heading: Privacy - How this website handles information.
- About this notice: This is the personal website of Samantha Fernando, composer. This notice explains the limited information the site handles and the choices you have. For questions about this notice or the website, use the contact form.
- Enquiries: If you send a message through the contact form, the details you enter (your name, email address, inquiry type and message) are sent directly from your browser to Formspree, the service that delivers them, so your enquiry can be read and answered. Read Formspree's privacy policy (opens in a new tab). Please do not include unnecessary sensitive information in a message.
- Cookie settings: Use Cookie preferences to accept, reject or change analytics cookies at any time. You can return to these settings from the Privacy link in the footer of any page. The panel notes that analytics cookies stay off without JavaScript.
- Analytics cookies: With your permission, this site uses Google Analytics to understand which pages are useful. It is optional and does not load unless you accept. If you accept, Google Analytics helps Samantha understand aggregate visits, pages viewed, referral sources, device and browser categories, and approximate location. It may set cookies or use similar storage after you accept. If you reject, Google Analytics is not loaded. Your choice is saved in your browser's local storage so that you are not asked again. If you later reject after accepting, analytics is turned off and its cookies are deleted. You can change your choice at any time using the Cookie preferences button above. Google Analytics is provided by Google. Read Google's privacy policy (opens in a new tab).
- Display preference: If you use the theme button in the site header, your choice (light or dark) is saved in your browser's local storage so that the site looks the same next time you visit. This choice stays on your device, is not sent to anyone, and is not used for analytics or tracking. You can remove it at any time by clearing this site's data in your browser.
- Your choices: You can accept, reject or change analytics cookies at any time using Cookie preferences above. For questions about information connected to an enquiry, use the contact form.

## Footer Links

- Privacy: /privacy/#cookie-settings (jumps directly to analytics cookie settings)
- SoundCloud: https://on.soundcloud.com/Ohbj2UPBnWa5Scw8AB
- Instagram: https://www.instagram.com/_samfernando_/
- Linktree: https://linktr.ee/samanthafernando
- Spotify: https://open.spotify.com/artist/1AOLNCJ11mI6ewx8CZ8gvM
- NMC Profile: https://www.nmcrec.co.uk/composers/samantha-fernando
- Copyright line: © year Samantha Fernando, followed on its own line by the credit: Made with ♥ by Nick (https://nickcaplan.github.io/websites-by-nick/)

## Visual References

- Christian Mason: https://www.christianmason.net/
- Gavin Higgins: https://www.gavinhiggins.com/
- Manchester Collective: https://manchestercollective.co.uk/
- Tonia Ko: https://toniako.com/
