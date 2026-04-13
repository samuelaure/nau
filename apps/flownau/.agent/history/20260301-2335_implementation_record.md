# PLAN: Flownau Autonomous Architecture 

## A. Project Constraints & Implementation Principles
1. **Evolution, Not Destruction**: The existing static template system (e.g., `ASFA-T1`) must remain functional. It will be encapsulated as the `LegacyTemplateRenderer` until we feel confident migrating them.
2. **Template Data Model Strategy**: Instead of coding hard React templates or relying on LLMs to hallucinate mathematical layouts from scratch, **Templates are JSON objects saved in the Database**.
3. **Template Builder Tooling**: We will build an AI-assisted UI to let human supervisors construct, iterate, and verify new templates dynamically, ensuring perfect formatting without touching code.
4. **Stable Engine Dynamics**: To support infinite variable content, the Remotion interpreter will implement robust boundaries natively (e.g., auto-scaling text boxes, grid boundaries) so that if an AI chooses short or long text, the visual design never breaks.
5. **Smart Templating Agent**: The Video Generation agent will *choose* the optimal template based on its description and provide the *content* (Assets + Copy), acting as a Director, not a Mathematician.
6. **Self-Sufficient Automated Generation**: We will eliminate the need for Make.com and Airtable by migrating the "Brand Pre-trained Content" loop natively into the Flownau ecosystem. This implies decoupling the ideation phase, the content preparation phase, and the scheduling phase.

## B. Project Identity
- **Name & Type**: flownau | Omnichannel Video Automation Platform 
- **Core Stack**: 
  - **Runtime & Framework**: Node.js 20+, Next.js 16 (App Router), React 19
  - **Video Engine**: Remotion 4.x
  - **Database**: PostgreSQL (via local Docker) + Prisma ORM
  - **Validation & State**: Zod, Zustand

## C. Architectural Blueprint
### 1. Modules
- **The Template Builder UI**: A dynamic editing suite where users start with a base JSON structure, prompt an AI to modify the object (e.g., "add a 3rd image at the bottom"), and view a live Remotion preview loaded with placeholder data. Includes history iteration and CRUD tools.
- **Dynamic Interpreter (Remotion)**: The Master component inside Remotion itself. It accepts a `Template` JSON and a `ContentMap` (from the LLM), merges them, and renders robust primitives (Text that adapts to lines, safe-zone bounding boxes).
- **Agent Intelligence Core**: The module responsible for receiving the user's prompt + brand assets, scanning the available **Template Descriptions** in the Database, and outputting specific mapped content to fill the Template's "slots".
- **Autonomous Content Engine**: The async pipeline replacing Make.com/Airtable. It comprises:
  - *Idea Generation*: AI uses the brand's `BrandPersona` (Personality/Tone) + the brand's `ideasFrameworkPrompt` to batch-generate raw content ideas.
  - *Content Drafting*: AI uses an approved Idea + the targeted Template's `contentPrompt` to generate a final `Composition`.
  - *Scheduler/Publisher*: A background worker picks the next approved `Composition` based on an account's global posting frequency.

### 2. Data Models (Prisma)
```prisma
model BrandPersona {
  id                      String   @id @default(cuid())
  accountId               String
  name                    String   // e.g. "Sassy Educator", "Formal B2B"
  systemPrompt            String   @db.Text
  ideasFrameworkPrompt    String   @db.Text // Controls the structure/logic of how ideas are brainstormed
  isDefault               Boolean  @default(false)
  autoApproveIdeas        Boolean  @default(false) // Ideas skip PENDING and become APPROVED
  autoApproveCompositions Boolean  @default(false) // First half of trusted composition state
  
  account      SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model VideoTemplate {
  id                      String   @id @default(cuid())
  name                    String
  description             String   @db.Text // Auto-generated short description for LLM target selection
  contentPrompt           String   @db.Text // New: The prompt that instructs the AI what data this specific template needs
  schemaJson              Json     // The structural JSON blueprint
  isActive                Boolean  @default(true) // Is this template included in the AI content generation selection?
  autoApproveCompositions Boolean  @default(false) // Second half of trusted composition state
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  compositions  Composition[]
}

model ContentIdea {
  id          String   @id @default(cuid())
  accountId   String
  ideaText    String   @db.Text
  status      String   @default("PENDING") // PENDING, APPROVED, REJECTED, USED
  createdAt   DateTime @default(now())
  
  account     SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Composition {
  id          String   @id @default(cuid())
  accountId   String
  templateId  String
  payload     Json     // The mapped content variables the AI outputted (Text strings, Asset IDs)
  videoUrl    String?
  status      String   @default("DRAFT") // DRAFT, APPROVED, PUBLISHED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  account     SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  template    VideoTemplate @relation(fields: [templateId], references: [id])
}

model PostingSchedule {
  id            String   @id @default(cuid())
  accountId     String   @unique
  frequencyDays Int      @default(1) // E.g., post every X days
  lastPostedAt  DateTime?
  
  account       SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

### 3. API Surface (Internal)
- `POST /api/templates/ai-iterate`: The endpoint powering the UI Builder. Takes a base JSON, a prompt, and returns a modified JSON structure.
- `POST /api/agent/idea-generation`: Batch generates `ContentIdea` rows using a specific `BrandPersona`.
- `POST /api/agent/compose-draft`: Takes an APPROVED `ContentIdea`, selects a `VideoTemplate`, uses its `contentPrompt`, and generates a DRAFT `Composition`.
- `POST /api/render/dynamic`: Merges a `VideoTemplate.schemaJson` with a `Composition.payload` and dispatches the Remotion job via the Dynamic Interpreter.

## D. Starter Instructions (For /starter)
*(Relevant for Phase 1 execution)*
- Run Prisma migrations for the new `VideoTemplate`, `Composition`, `BrandPersona`, `ContentIdea`, and `PostingSchedule` models.
- Set up a robust seed file or backup mechanism for `VideoTemplate` so structures are not lost if the database is reset.

## E. Execution Roadmap (The Pivot)
- **Phase 1: Foundations & Database Design.** Update Prisma with the new Data Models. Build the CRUD routes for managing Templates to ensure they can be backed up and restored.
- **Phase 2: The Template Builder UI.** Build an interactive AI "Chat & Edit" interface. Shows a side-by-side preview with placeholder media. The user issues modifications, preview updates. Allows saving the final JSON to `VideoTemplate`. Includes UI to edit the Template-scoped `contentPrompt`.
- **Phase 3: The Dynamic Interpreter Engine.** Construct the Master Remotion generic composition. This component reads the JSON template format and enforces native "responsive" rules for video (e.g., flexible text bounding boxes).
- **Phase 4: Agent Refactoring & Manual Selection.** Update `agent.ts` to use Template selection. Instruct it to output a `ContentMap` payload.
- **Phase 5: The Autonomous Content Pipeline (Make.com Replacement).** Build the UI for Brand Personas and Idea Generation. Build the list allowing users to APPROVE ideas to proceed to Drafts, and APPROVE Drafts to be scheduled.
- **Phase 6: The Global Posting Scheduler.** Build the local Cron worker/loop that queries account global posting frequencies, grabs the oldest APPROVED Composition, renders it via Remotion, and pushes it to Instagram Graph API.
- **Phase 7: Captions & Enhanced Audio Handling.** Empower `DynamicInterpreter` to render semantic Subtitle tracks and implement synchronized audio bounds ensuring sound layers scale accurately against video timestamps without collisions.
# PHASE 0: Universal Schema & Foundations

## Objectives
Establish the JSON grammar of the Dynamic Composition Engine. This involves creating the atomic building blocks (Primitives), defining the exact strict structure representing the entire timeline layout in code so the AI knows exactly what parameters to fill, and updating the database.

## Tasks
- [x] Create `schema.ts` defining the Zod payload for `DynamicCompositionSchema`. It must encapsulate the duration, scene configurations, safe-zones for text, and asset references without relying on arbitrary coordinates.
- [x] Add the `Composition` model to the `schema.prisma` file to persist JSON payloads, prompt inputs, and the `brandId`.
- [x] Run `npm run prisma:migrate` to push the new database schema locally.
- [x] Scaffold the `DynamicComposition` folder in `src/modules/rendering/` containing the core React component (the interpreter root) alongside its dedicated `primitives/` directory.
- [x] Implement the first Primitive: `MediaNode`. This component should strictly handle video cropping, parsing scale coordinates, and overlay layering given an asset context without internal state.
- [x] Implement the second Primitive: `TypographyNode`. This component must manage strict, mathematical text wrapping and entrance animations without clipping bounds, taking styling arguments strictly defined by the Zod schema.

## Verification Criteria
- [x] The `Composition` table is verifiable in `prisma studio`, tied sequentially to a `Brand`.
- [x] `zod` parse logic succeeds given a mock arbitrary configuration JSON matching the `DynamicCompositionSchema`.
- [x] A static hardcoded instance of `DynamicComposition` renders the `MediaNode` and `TypographyNode` side by side successfully on a generic video timeline within the Remotion Player.

builder: Phase 0 completed. Created the DynamicComposition primitives, established the strict Zod schema, updated Prisma schema, and pushed the database migration. Added the component to the main Remotion definitions for verification.
# Phase 1: Foundations & Architecture

**Objective**:  
Update the schema to support JSON database templates representing Remotion geometry, abandoning hardcoded React templates for new compositions. Establish the data architecture for the Autonomous Content Engine replacing Airtable/Make.com (Brand Personas, Content Ideas, Posting Schedules).

## Tasks

### 1. Prisma Data Modeling Updates (`prisma/schema.prisma`)
- [x] Add the `VideoTemplate` model with `id`, `name`, `description`, `contentPrompt`, `schemaJson`, `isActive` and `autoApproveCompositions`.
- [x] Add the `BrandPersona` model to store system prompts for idea generation (`accountId`, `name`, `systemPrompt`, `ideasFrameworkPrompt`, `isDefault`, `autoApproveIdeas`, `autoApproveCompositions`).
- [x] Add the `ContentIdea` model (`accountId`, `ideaText`, `status: PENDING/APPROVED/REJECTED/USED`).
- [x] Refactor the existing `Composition` model to belong to a `VideoTemplate` via `templateId`. Add a `payload` structure holding mapped content, and add a `status` field (`DRAFT`, `APPROVED`, `PUBLISHED`).
- [x] Add the `PostingSchedule` model (`accountId`, `frequencyDays`, `lastPostedAt`).

### 2. Base API Routes & CRUD
- [x] Create `src/app/api/templates/...` routing for `VideoTemplate` Records.
- [x] Create `src/app/api/personas/...` routing for `BrandPersona` Records.

### 3. Seeding & Export Utilities
- [x] Create a Node script (e.g., `scripts/export-templates.ts`) that dumps all templates in the database to a `.json` backup file locally.
- [x] Update `prisma/seed.ts` (or equivalent) to ingest any backed-up JSON files ensuring templates survive environment wipes.

## Verification Criteria
- [x] DB migration applied successfully.
- [x] Able to manually create a template record and a brand persona via Prisma Studio. 
- [x] A script successfully exports templates to a local JSON file. 

**builder:** Phase 1 implementation files created including schema models, API scaffolding, Prisma client generation, seed updates, and the export scripts. Docker instantiated and Postgres database migrated successfully. Ready for Phase 2.
# Phase 2: The Template Builder Interface

**Objective**:  
Construct a specific dashboard module where human admins can visually verify and rapidly iterate JSON Remotion layouts without manually touching code geometry. This UI allows an LLM to take base configuration, apply the prompt (modify/improve), and show instant visualization using placeholder media so layout robustness can be tested before deployment.

## Tasks

### 1. The Builder Page (`src/app/dashboard/templates/builder/page.tsx`)
- [x] Implement a two-pane UI: The left pane houses the Remotion `@remotion/player` (with dummy filler text and generic asset placeholders). The right pane houses the chat interface and the raw JSON editor.
- [x] Add a visual configuration tool to inject "Placeholder Data Lengths" (e.g., Short text, Long text) to test string boundary robustness inside the template.

### 2. The AI Iterator Router (`src/modules/video/builderAgent.ts`)
- [x] Create a specific system prompt instructing the LLM: "You are editing a Template Schema. You receive the current JSON. ONLY return the modified JSON based on the user's explicit request."
- [x] Establish an iterative loop so the chat window replaces the base JSON object continuously. 
- [x] Implement an undo history or snapshot feature mapping previous iterations.

### 3. Save & Persistence
- [x] At the end of the creation workflow, query an LLM to auto-generate a succinct `description` indicating what this template is best used for. Present this description to the user in an editable textarea so they can modify or override it before saving.
- [x] Add toggle UI components allowing the user to set the template's `isActive` status and `autoApproveCompositions` (trusted state) setting.
- [x] Implement full saving functionality linking the active JSON object, name, settings, and generated description back to the REST API.

## Verification Criteria
- [x] A developer can type "Move the text to the bottom right and make the font 40px", hit send, and the Remotion Preview visually reflects this change automatically.
- [x] The finalized iteration can be saved strictly back to PostgreSQL as a valid `VideoTemplate`.

**builder:** Phase 2 fully completed. Builder page UI instantiated, dynamic importing Remotion mock established, Groq LLM pipelines connected. Null typing errors resolved. Ready to deploy Phase 3.
# Phase 3: The Dynamic Interpreter Engine

**Objective**:  
Inside Remotion, we must build universal rendering rules governing boundaries. Since templates contain layout instructions, but the AI Content Agent can pass 5 words or 20 words, the Interpreter must calculate bounding boxes correctly around standard CSS flex constraints to maintain visual quality without explicit frame coordinates from the AI.

## Tasks

### 1. The Universal React Nodes
- [x] Create `ResponsiveTextNode.tsx`: Interprets bounding boundaries, maximum widths, font scaling rules, safe margin enforcements preventing overlap with the Instagram UI natively.
- [x] Create `ResponsiveMediaNode.tsx`: Intelligent cover/contain mapping matching the schema JSON structure.
- [x] Create `DynamicTemplateMaster.tsx`: The composition root file in Remotion. It fetches the database schema template, maps the content payloads from the agent iteratively into the responsive nodes, and sequences them sequentially based on `schemaJson`.

### 2. Rendering Testing
- [x] Mock a template and push extreme payloads (e.g., heavily wordy paragraphs) to ensure the bounding box scaling engine behaves elegantly instead of bleeding off the screen.

## Verification Criteria
- [x] `DynamicTemplateMaster` can take JSON payload instructions + mapping and render the exact same composition identical to the UI builder representation in Phase 2.
- [x] Passing 300 characters vs 30 characters does not break the layout of the exported `.mp4`.

**builder:** Phase 3 implementation complete. Created `ResponsiveTextNode.tsx` measuring character counts to scale typography within Instagram/TikTok boundaries, `ResponsiveMediaNode.tsx` using `OffthreadVideo` mapped to exact bounding properties, and completely linked sequences inside `DynamicTemplateMaster.tsx`. Render engine bound to `index.tsx` perfectly and type-check clear.
# Phase 4: Target-Selection AI Workflow

**Objective**:  
Now that the templates are structurally sound, the original `agent.ts` must be refactored to act as a Director. It will choose the best container, fill it with text/assets, and return a lightweight map instead of heavy math.

## Tasks

### 1. The Director Prompt
- [x] `agent.ts`: Query all available `VideoTemplate` descriptions from the DB. 
- [x] Modify the Llama-3 system prompt: Instruct the AI to choose ONE valid database template matching the tone of the request.
- [x] Provide the structural slots mapped in the `VideoTemplate`, having the AI return "Text Content X: [String]" and "Media Slot Y: [AssetID]" instead of `{x:0, y:0, frames:90}`.

### 2. Integration Pipeline (`src/app/api/agent/compose`)
- [x] Refactor the composition backend route:
   - [x] Accept User Prompt.
   - [x] Run AI step (outputs: Template ID + Content Variables).
   - [x] Look up Template ID.
   - [x] Merge AI string Variables into Target Template.
   - [x] Dispatch to Remotion.

## Verification Criteria
- [x] When prompted for an Educational post, the agent consistently selects the DB Template explicitly named/described as Educational.
- [x] The composition merges and generates the final video without hallucinating mathematical values.

**builder:** Phase 4 completed. Refactored `agent.ts` to fetch dynamically scaled Active Templates from Prisma and feed `slot_id` arrays to Llama 3 for pure structural map output rather than hallucinated geometries. Created mapping integration in the router merging those generated strings back onto the target base layout natively.
# Phase 5: The Autonomous Content Pipeline (Ideation & Drafting)

**Objective**:  
Migrate the Airtable & Make.com workflows natively into Flownau. This involves building the UI and backend logic to handle Brand Personas (system prompts), generate raw content ideas asynchronously, and allow users to manually approve them into Composition DRAFTS mapped against a selected Video Template.

## Tasks

### 1. Brand Personas & Ideation (Step 1)
- [x] Build a Brand Persona Dashboard inside the Account view. Forms should include fields for `systemPrompt` (Brand personality) and `ideasFrameworkPrompt` (Ideation structure).
- [x] Build the Idea Generation Worker route `POST /api/agent/idea-generation`: Triggered manually or by a cron. Uses the Brand's default Persona to generate raw ideas. The API call must concatenate the `systemPrompt` + `ideasFrameworkPrompt` to instruct the AI.
- [x] **Trust Logic Implementation**: If `BrandPersona.autoApproveIdeas` is true, newly generated ideas are inserted as `APPROVED`. Otherwise, they are `PENDING`.

### 2. The Multi-Step Approval UI
- [x] Build the "Content Backlog" UI: A Kanban or List view showing Ideas sorted by `PENDING`. 
- [x] A user clicking "Approve" (or the worker grabbing `APPROVED` ideas natively) triggers `POST /api/agent/compose-draft`:
  - [x] AI takes the IDEA + looks at descriptions of valid templates (`VideoTemplate.isActive == true`).
  - [x] Returns target Template ID and payload.
  - [x] **Content & Asset Generation**: The backend uses the Template's `contentPrompt` to enforce format output and text generation. *Note: Background Media and Audio assets will be selected randomly for this phase until an asset-description intelligence layer is added later. Ensure the randomizer logic accounts for the number of slots required by the Schema (e.g., if a template requires 3 background videos, it must randomly select 3 distinct assets).*
  - [x] **Trust Logic Implementation**: If BOTH `BrandPersona.autoApproveCompositions` AND `VideoTemplate.autoApproveCompositions` are true, the final Composition is created as `APPROVED`, bypassing human review. Otherwise, it is created as `DRAFT`.
  - [x] The original `ContentIdea` is marked `USED`.

### 3. Reviewing Composition Drafts (Step 2)
- [x] Build the "Composition Drafts" UI: A view allowing the user to preview a prepared `DRAFT` using the Remotion Web Player. 
- [x] A user clicks "Approve for Publishing", moving the Composition status from `DRAFT` to `APPROVED`.

## Verification Criteria
- [x] Triggering Idea Generation populates the DB with raw ideas styled according to the Brand Persona's system prompt.
- [x] Approving an Idea correctly utilizes a template's `contentPrompt` to generate a structured JSON payload mapped to a Video Template.
- [x] The user can successfully preview a Draft before clicking Approve.

**builder**: Phase 5 completed. Brand Persona creation implemented. Autonomous Idea brainstorming connected directly against LLM constraints. Idea backlog and Draft viewers wired dynamically rendering inside Next.js tabs bridging API updates into PostgreSQL states.
# Phase 6: The Global Posting Scheduler

**Objective**:  
Fully automate the publishing aspect of the pipeline. Build a worker that polls account frequencies and autonomously renders/posts the pre-approved Composition Drafts.

## Tasks

### 1. The Global Posting Worker
- [x] Implement a Node cron or Redis-based (e.g., bullmq) worker mechanism isolated strictly to the loop logic. 
- [x] The Worker queries `PostingSchedule` to find accounts whose `(lastPostedAt + frequencyDays)` is due or overdue.

### 2. The Render & Publish Pipeline (Step 3)
- [x] The Worker pulls the oldest `APPROVED` Composition for the due Account.
- [x] The Worker triggers the backend render pipeline mapping the payload into Remotion, pushing to Cloudflare R2.
- [x] Upon R2 success, trigger the Instagram Graph API multi-step publish flow (Container Init -> Status check -> Publish).
- [x] Update `Composition.status` to `PUBLISHED` and update `PostingSchedule.lastPostedAt` to `now()`.

### 3. Scheduler Settings UI
- [x] Add a simple "Publishing Settings" panel in the Account Settings.
- [x] Allow users to define their frequency (e.g., Post every 1, 2, or 3 days). 

## Verification Criteria
- [x] Setting an account to 1-day frequency correctly triggers the worker locally.
- [x] The worker successfully retrieves an Approved draft, renders the video headless, uploads to R2, and posts to an Instagram testing account.
- [x] No manual clicks are required once a draft is Approved.

**builder**: Phase 6 has been completed. Designed `AccountSchedulerSettings` natively integrating into `/api/schedule` handling dynamic posting cadence metrics mapping on Database `PostingSchedule`. The Global Posting Worker executing pure loops handles full headless Next.js Remotion `.mp4` packaging uploading synchronously inside R2 object blocks, passing the URL and inferred target constraints toward the Instagram IG API graph payload queue marking drafts explicitly `PUBLISHED`.
