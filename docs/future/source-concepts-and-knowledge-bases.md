# Source Concepts & Knowledge Base Restructure

> Working plan capturing a multi-part discussion about restructuring naŭthenticity's profile/post categories, source-concept generation, and idea generation.
> Status: discussion in progress, no implementation started.

## Priority order (this plan)

1. naŭthenticity four-category restructure + unified Social-Profile/Post-Collection pattern + cross-category linking
2. LLM-decides count (default with optional override) + remove `+ Add idea` in flownaŭ
3. InspoBase → many source concepts for flownaŭ
4. Zazŭ voicenotes → source concepts

## Next steps after this plan

See [`brand-context-migration.md`](./brand-context-migration.md) — that plan carries the full ordered list of what follows.

---

## Implementation ground rules

1. **Schema migrations**: any schema change must include a proper migration file (never alter the DB directly or bypass the migration system).
2. **Branch**: create a new temporary development branch before starting implementation.
3. **Env variables**: if new env vars are added, update all four: `.env.example`, `.env.development`, `.env.production`, and GHSecrets (via `gh secret set` using `.env.production` with CRLF stripped via `sed 's/\r//'`).
4. **Local-first testing**: set up local environment with mock/seed data that mirrors production shape before any production deploy. All testing happens locally first.

---

## Priority 1 — naŭthenticity profile/post category restructure

### The four categories (renamed for clarity)

| Category | Was called | Purpose |
|---|---|---|
| **Own Profiles** | `content` | Brand's own social profiles. Posts saved as a knowledge base for brand context, insights, replication of high-performers, content chat, topic search, analytics, backup. Most consumers not yet implemented — but the data foundation is the goal. |
| **Comment Profiles** | (was conflated with `content`) | Profiles monitored to generate comment suggestions. Two sub-flows:<br>• **Proactive**: monitored profile posts → system generates comment suggestions automatically<br>• **Reactive**: user sends a specific post from naŭ Mobile App → on-demand comment suggestions<br>Added from naŭthenticity UI, Zazŭ dashboard, or naŭ Mobile App. |
| **InspoBase** | `inspiration` | User-curated inspiration source. Compilation of:<br>• Specific captured posts (sent from naŭ Mobile App)<br>• Inspirational social profiles (added from naŭ Mobile App or naŭthenticity)<br>Acts as a single high-level entity from which source concepts are derived. |
| **Benchmark/Study** | `benchmark` (currently unused) | Profiles & posts that are *not* owned, *not* for commenting, *not* inspirational. Pure knowledge base for studies, analytics, insights, pattern recognition, content chat, topic search.<br>**Default-absorption rule**: When a profile/post is removed from all other categories (InspoBase and Comment Profiles), it is **not deleted** — it falls through to Benchmark/Study by default. So if a profile/post isn't InspoBase or Comment, it lives in Benchmark/Study. |

### Standardized pattern across all four categories

Two observations that drive a unified data model:

1. **All four categories contain Social Profiles and Post Collections** (Own Profiles is the only one that today has no concept of loose posts — TBD whether it should).
2. **Loose posts are grouped into one collection per category, and that collection is treated as if it were a Social Profile** — same feature surface as a real profile.

For both Social Profiles and Loose-Post-Groups-as-Social-Profile, we offer the same suite of features:
- Knowledge base for insights, analytics, pattern recognition
- "Chat" with the content
- Topic/post search
- Custom data extraction

### Cross-category linking (no duplication)

A single Social Profile or Post can be linked to **multiple categories simultaneously**. Example: profile X is brand A's monitored comment profile *and* brand B's inspiration source. We store X once and attach category-membership records — no duplicate storage, no duplicate scraping, no duplicate API costs.

### Status
- This is the heaviest and highest-priority item.
- No schema yet drafted — discussion ongoing.

### naŭ Mobile App — capture modal alignment (Priority 1 + 3 surface)

The mobile app capture modal is a primary entry point for users to feed posts/profiles into the four categories. Its action labels and behaviors must align with the new category names and add the missing source-concept actions.

**Sequencing**: backend (naŭthenticity schema/endpoints) lands first; mobile-app modal updates follow as a separate effort using the new endpoints.

#### Capture modal — actions to rename, split, add

| Current action | New action | Description | Notes |
|---|---|---|---|
| Add Profile (Proactive) | **Suggest Comments (Profile)** | "Suggest Comments for each new post on this Profile" | Adds a Comment Profile — proactive monitoring |
| Generate Comment (Reactive) | **Suggest Comments (Post)** | "Suggest comments for this post" | One-off reactive comment generation |
| Add to InspoBase | **Add Profile to InspoBase** | "Save this profile as inspiration for content ideas" | Split from single "Add to InspoBase" |
| Add to InspoBase | **Add Post to InspoBase** | "Save this post as inspiration for content ideas" | Split from single "Add to InspoBase" |
| *(missing)* | **Add Profile to Benchmark/Study** | "Track this profile for analytics, insights, and pattern recognition" | Adds a Benchmark/Study profile (also where profiles fall by default if removed from other categories) |
| *(missing)* | **Add Post to Benchmark/Study** | "Save this post for analytics, insights, and pattern recognition" | Adds a Benchmark/Study post |
| *(missing)* | **Send Profile as Source Concept** | "Generate ideas now from this profile and save it to InspoBase" | Adds the profile to InspoBase **and** triggers a one-time-use generation of N source concepts from that profile's content for the flownaŭ ideation engine. Profile remains in InspoBase for future manual re-use. Tied to Priority 3. |
| *(missing)* | **Send Post as Source Concept** | "Generate ideas now from this post and save it to InspoBase" | Adds the post to InspoBase **and** triggers a one-time-use generation of N source concepts from that post for the flownaŭ ideation engine. Same re-use semantics. Tied to Priority 3. |
| Mark for Replication | **Plan for Replication** | (existing — to keep, just rename) | Detailed plan moved to [`replication-posts.md`](./replication-posts.md) |
| Queue Repost | **Queue Repost** | (existing placeholder — keep) | Detailed plan moved to [`repost-lifecycle.md`](./repost-lifecycle.md) |
| *(missing — placeholder)* | **Send Profile/Post to Project** | Capture into a Project's knowledge base | Detailed plan moved to [`project-entity.md`](./project-entity.md) |

#### Out of scope for this plan (moved to separate docs)

- **Cross-brand de-duplication** (shared-singleton profile/post records) → [`cross-brand-deduplication.md`](./cross-brand-deduplication.md)
- **Replication posts** lifecycle, type extensions, LLM rules → [`replication-posts.md`](./replication-posts.md)
- **Repost lifecycle** (Posts to Repost section, permission-request flow, follow-up cadence) → [`repost-lifecycle.md`](./repost-lifecycle.md)
- **Project entity** (Brand-peer entity, workspace scoping, capture surface) → [`project-entity.md`](./project-entity.md)
- **naŭ Mobile App architecture refactor** (centralized Instagram processing, per-app storage, user→workspace refactor, data migration from old mobile app) → [`mobile-app-architecture-refactor.md`](./mobile-app-architecture-refactor.md)

See "Next steps after this plan" at the top for the order in which these will be tackled. Their modal entries remain visible as placeholders so they're not forgotten.

---

## Priority 2 — LLM-decides count + remove `+ Add idea` in flownaŭ

### LLM-decides count (naŭthenticity + flownaŭ)

Adopt this prompt frame as the default for both source-concept generation and idea generation:

> "Generate as many as genuinely capture distinct angles, but be moderate — quality over quantity."

User retains optional control:
- Set a **specific amount**, OR
- Set **min/max** bounds.

Default = LLM-decides. Refactor touches both naŭthenticity (source concepts) and flownaŭ (ideas).

### Remove `+ Add idea` in flownaŭ

Decision: **remove `+ Add idea`** from flownaŭ. Pre-formed ideas should come through Zazŭ capture (which skips LLM ideation and directly creates a Post). flownaŭ's idea-creation surface should be AI-powered (Brainstorm) only.

Simple cleanup — can be done independently of the larger restructure.

---

## Priority 3 — Stand-by: InspoBase → many source concepts for flownaŭ

Today the InspoBase digest produces **one** aggregated source concept per ideation run. We want to produce **many**, each driving a separate idea batch in flownaŭ.

**Core principle:** From the source-concept perspective, the InspoBase is a **whole-single-entity**. Source concepts must come from a **top-level high-understanding interpretation of the whole information stored** — not from individual posts or profiles.

### Additional pipeline (user-triggered, specific)

A separate flow for user-driven specific extraction:
- User captures/sends a specific post or Social Profile from naŭ Mobile App → system generates source concepts from *that specific source* → also adds it to the InspoBase.
- naŭthenticity UI should expose features for the user to trigger specific source-concept generation from one or many selected social profiles or posts. Details TBD.

Details to be discussed when its time comes.

---

## Priority 4 — Stand-by: Zazŭ voicenotes → source concepts

Zazŭ's first priority feature: voicenotes processing as content source-concept capture.

### Basic Zazŭ behavior (no cross-app)
1. User sends voicenote.
2. Save audio file (URL).
3. Transcribe (raw transcription).
4. Clean transcription.
5. Persist all three (audio URL, raw, clean) in DB.

### Distribution to naŭthenticity (first integration)
Take the clean transcription → send to naŭthenticity InspoBase with two intentions:
- **A. Specific source extraction**: generate source concepts from this capture → forward each to flownaŭ → one idea batch per source concept.
- **B. Persist in InspoBase** as a Zazŭ sourcing capture (new InspoBase element type: voicenote captures, alongside posts and profiles).

### Open question — brand routing
How does the system know which brand(s) the capture belongs to?

- **Option A (clean/stable):** After the user sends the voicenote, Zazŭ asks which brand(s) to route to (multi-select).
- **Option B (smart):** System is user-brands-aware and intelligently analyzes the content to pick the brand(s).

Decision pending. Option A first; Option B as a later enhancement.

Details to be discussed when its time comes.

---

## Out of scope / done

- **`BrandIntelligence` → `Brand` rename** + SocialProfile ownership/monitor split: **already implemented.** Old plan `dynamic-prancing-crab.md` deleted.

---

## User's original message (verbatim, for review)

> I'll go one by one, to continue talking to define details... For now, save what is being discussed and decided in a plan document in docs/future folder. Also include this exact message for me to review in case I forgot something.
>
> ---
> 1 & 3 - Do not confuse 'Content' with 'Commenting'...
> Content - We should rename this for clarity to 'Own Profiles' instead of 'Content', or something like that, because basically these are the brand's own social profiles. We save the posts in database for many reasons, most of them aren implemented yet, but its in general a knowledge base to generate brand context, get insights, create more of what performed well, to 'chat' with the content, to search specific topics/posts, analytics, backup,...
>
> Comments - We have two types, proactive (monitored social profiles that generate comment suggestion when that profiles post a new post) and reactive (the user send an specific post from naŭ Mobile App to get comment suggestions). The user can add new monitored social profiles from naŭthenticity UI, Zazŭ dashboard or from naŭ Mobile App.
>
> InspoBase - From naŭ Mobile App the user can send/capture specific posts that are saved in naŭthenticity as a compilation/collection of posts for content inspiration (InspoBase). The user can also set a social profile as part of the InspoBase. The Inspirational Social Profile can be added from both, naŭ Mobile App and naŭthenticity.
>
> Benchmark - Simply social profiles and posts that aren't brand owned, set for comment suggestion nor as inspirational source. These will be used as knowledge base for studies, analytics, insights, pattern recognition, 'chatting' with the content, search specific topics/posts,...
>
> Expressed this way I can see a patterns that should be standarized globally inside naŭthenticity.
> - In all four categories are 'Social Profiles' and 'Posts compilation/collections' (only Brand own profiles category doesn't have post compilation/collections).
> - Loose Posts are grouped in one compilation/collections per category, and that compilation/collection is treated as if it was one Social Profile more, but it contains all loose posts of that category.
> - For both Social Profiles and Loose Posts Group-as-Social-Profile across all category, we offer the same suit of features to interact with. Each one is a knowledge base to get insights, analytics, pattern recognition, 'chat' with the content, search specific topics/posts, analytics, extract data based on custom requests,...
>
> Lastly, one Social Profile or post can be linked with more than one category, so we avoid duplication and scalate the provided value.
>
> This is the heaviest point, and also the priority/goal implementation we should focus on. The other points are simply to tackle so here they are:
>
> ---
> 2. The InspoBase digest that generate source concepts for flownaŭ pipeline is the next topic we will tackle after the first one. So, put it in a documented stand by to go back to it after the priority implementation.
>
> A To do note for this: From the concept sourcing perspective, the InspoBase is a whole-single-entity from where we extract source concepts to generate ideas and create content from. Those source concepts must come always from a top-level high understanding/interpretation of the whole information it store (social profiles and posts collection), not from specific posts or social profiles...
>
> Additional note: We will implement a pipeline that extract source concepts from specific posts and social profiles (that are also added into the InspoBase), but that will be specifically set by the user... for example, the user capture/send from naŭ Mobile App a post or a Social Profile to generate source concepts from that specific capture. In this case we do generate source concepts from that specific source, and then we add it to the InspoBase.
>
> Other additional note: From naŭthenticity UI, we should also offer features so the user can trigger the specific sourcing concept generation. It can be from One or many social profiles or posts... Details about this will be discussed later.
>
> Clear enough?
>
> ---
> 4. Flownaŭ - Yes, let's remove the '+ Add idea' feature.
>
> ---
> 5. Zazŭ - This app is pending for great development, but for practicity and fast advance, I'll focus in priority features, more specifically, in voicenotes processing as content source concepts capture, generation and distribution to naŭthenticity and flownaŭ.
>
> naŭthenticity - I'll add an extra element in InspoBase category that is voicenotes captures from Zazŭ, so we can use that also as InspoBase source data.
>
> What I want is to save voicenotes audio files, transcribe it and clean it (audio file url, raw transcription and clean transcription are all saved in database). This is a basic Zazŭ behavior, still nothing related to other apps.
>
> Then, we take the clean transcription to process it into many things, but for now, the only destination we will implement is 'Source Concepts Geration for flownaŭ'... Basically, we will take the clean transcription and send it to naŭthenticity InspoBase with two intentions:
> A - Specific source extraction/generation of source concepts that are then sent to flownaŭ to generate one batch idea per each one.
> B - Save it in the InspoBase as Zazŭ sourcing capture.
>
> One challenge we have here it's how the system will know to which brand or brands send that capture... I have two possible ideas:
> A - Cleanest/stable one: After the user sends the voicenotes, Zazŭ ask the user which brand or brands to send this capture ofering the list of brands for multiselecting.
> B - We make the system user-brands-awared and intelligenty analyze the content and select to which brand to send it.
>
> ---
> 6. Fixed count vs LLM-decides
> I like that "generate as many as genuinely capture distinct angles, but be moderate — quality over quantity"
>
> I still want to optionally control the amount by setting specific amount, or min/max, but I prefer to make default the LLM-decide approach for both, generating source concepts or ideas.
>
> This is a refactor that involve naŭthenticity and flownaŭ.
>
> ---
> 7. Cool, delete that plan then... however, in what you just mentioned, I catched something interesting/important... What if differents brands are connected to the same profiles/posts? I would like to implement something that improve performance, resource usage,... avoiding duplication. For example, a brand monitored profile is another brand own profile... or two brands have the same profile in their comment, inspo or benchmark profiles... or many brands capture the same post... we shouldn't duplicate/triplicate the data... because isn't only the double/triple storage, but also the computing, the third-party provider API service costs,...
>
> We are still in a early stage, but this is worth to consider to implement soon. So add this to docs/future plan.

---

## User's follow-up message — naŭ Mobile App scope (verbatim, for review)

> Add these improvements/implementation to the plan. Ask question if you need some clarifications and also save this exact message in the plan, after the one that it's already there. Make sure to understand and capture details properly in the plan.
>
> ---
> naŭ Mobile App - We have to audit the mobile app to understand what is already implemented and what needs to be refactored/implemented in order to match/sync with the planned improvements.
>
> Currently, in the naŭ Mobile App capture modal we have:
> - Add Profile (Proactive) rename it to 'Suggest Comments (Profile)': This is for the proactive comment suggestion. It have a short description that says 'Monitor this profile for new posts', but change it to 'Suggest Comments for each new post on this Profile'.
> - Generate Comment (Reactive) rename it to 'Suggest Comments (Post)', and the description change it to 'Suggest comments for this post'
> - Add to InspoBase: This should be splitted into 'Add Profile to InspoBase' and 'Add Post to InspoBase' and add their description accordingly.
>
> What's missing:
> - Send Profile as Source Concept: This action will add this profile to the InspoBase, but also will generate N source concepts for flownaŭ ideation engine in a one-time-use as single source for source concepts generation from that profile content (previously mentioned in the plan).
> - Send Post as Source Concept: Same as for profiles, but for that specific post (added to InspoBase, but also one-time-used as single source to generate N source concepts). Note: Of course, those posts/profiles can be used again as specific selected source for source concepts, but that is an intentional process done by the user.
>
> What's currently or missing that wasn't mentioned before:
> - (Currently implemente) 'Mark for Replication' rename it to 'Plan for Replication': these are posts that will be sent to flownaŭ -> unscheduled post to replicate. It's a post type extention (video+replicate, carousel+replicate, static/single image + replicate). It's displayed as a normal post, but it's modal shows the original source post (multimedia) and caption, until the user uploads its replication (respective multimedia file/s and caption). In that status the user uploaded content replace the original source content that is then hidden in a toggle off section below. The only LLM generation available for replacation posts it's for the caption text, the multimedia file/s must be uploaded by the user.
> - (Currently implemented) Queue Repost: I'll have some brands which content will be reposted content. These captures will be placed in a new section below 'Unscheduled posts' called 'Post to Repost'... We will generate a special comment suggestion or simply give the user the generic predefined (by user) comment to leave in that post that is to ask the author for permission to repost the post in our own profile. These posts have a different lifecycle... we will prompt the user to mark if the comment was sent and then prompt again in increased intervals to check if the permission was approved by the author (with a limit of course before discarding that post). Once the post is set to approved by the author, we may change the caption (LLM asisted or fully manual) and schedule the post to be posted on its time... We may need to go in deeper details. This feature is in stand-by but I would like to keep the option in the modal as placeholder to not forget and document this.
> - (Missing) Send profile/post to Project: This is something that I need to think more about to how implement it... But to leave it here as future reference/planning, it's to capture ideas, concepts,... in form of profiles/posts as reference/fundation of a project like my Abundance Mindset Digital Product, or my Content Creation Digital Product, or Karen's Survival Guide... These captures behave equally as InspoBase, Commenting, Benchmark (profile & post collection + features), but are linked to a project, and the project may be linked to a brand or not, but for sure to a Workspace. So, this will involve to create a Brand-same-level-entity called Project (may be, that's why I say I need to think more about it), and problably it will be managed and displayed by app.9nau.com and naŭ Mobile App (which is the mobile version of app.9nau.com).
>
> We have to double check what it's currently implemented so we get a clear picture of how/what it's working properly and what needs refactoring to match the new implementation.
>
> Also, we have to understand current architecture to implement the new features.
>
> On the other hand, the naŭ Mobile App itself was an captured posts inbox... Of course, this should be accordingly refactored too to coexist in harmony with the new implementations. But this is a talk for another moment, and again, I will leave some notes for reference:
> - All instagram captures will be processed by naŭthenticity, to centralize responsibility ownership, however, being processed by naŭthenticity doesn't mean displayed on naŭthenticity... For example, 'Post for replication' are processed (downloaded, optimized, transcribed, thumbnailed,...) by naŭthenticity, but displayed only in flownaŭ. What the mobile app currently capture for itself (not special features) will be also processed by naŭthenticity, but displayed in app/mobile-app. We may want to store the files in their respective app folder even that naŭthenticity process them, because at this level/cases, naŭthenticity works as a service provider for these apps.
> - What is currently attached to user + optional-tags, should be refactored into workspaces, so we can have the same app/mobile-app system and features, but now by workspaces... (tags by workspaces, projects, by workspaces, etc...)
> - I have a a bunch of captured posts in my old version app mobile, that data should be migrated safetly to the new architecture to be displayed again...
