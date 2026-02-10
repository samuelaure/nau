# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [6.8.1](https://github.com/samuelaure/whatsnau/compare/v6.8.0...v6.8.1) (2026-02-10)


### Bug Fixes

* **deploy:** stabilize production infrastructure and workflow ([1873362](https://github.com/samuelaure/whatsnau/commit/187336263a3a85bdb182bafb53e40bc73be519e8))

## [6.7.0](https://github.com/samuelaure/whatsnau/compare/v6.0.0...v6.7.0) (2026-02-05)


### Features

* **api:** add admin and health endpoints ([643e93c](https://github.com/samuelaure/whatsnau/commit/643e93c84d6f2462eb539d655ff371fbc147039e))
* **backend:** add cors and helmet for security hardening ([84c2e37](https://github.com/samuelaure/whatsnau/commit/84c2e37a3f95666a37136686778fde7d996b6775))
* **backend:** add sanitization utility for PII redaction and sensitive data masking ([a7675fc](https://github.com/samuelaure/whatsnau/commit/a7675fc1c09891f74cf00e10fd4cc8d997e3522e))
* **backend:** improve core orchestration type safety and resolve any assertions ([8239123](https://github.com/samuelaure/whatsnau/commit/823912372b4d0f9d8a262bab607321263e6834bb))
* **bootstrap:** integrate resilience features into application startup ([4fd1889](https://github.com/samuelaure/whatsnau/commit/4fd18895322a85deb68a5e12c00950064cf8a4c0))
* **ci:** harden deployment pipeline with quality gates and formal releases ([bc0fa78](https://github.com/samuelaure/whatsnau/commit/bc0fa7872418638a0fdfb99c7555afee3070a8c6))
* **config:** add global config service with caching and graceful degradation ([0b32629](https://github.com/samuelaure/whatsnau/commit/0b326291cd6f66e98a4018dd93950790914f46fc))
* **config:** enhance configuration validation and security ([7e576bd](https://github.com/samuelaure/whatsnau/commit/7e576bdbe6cc7a9e017a734e2c56ef90ec5de955))
* **db:** add monitoring models and migration ([0520a5b](https://github.com/samuelaure/whatsnau/commit/0520a5b9a6d6471ce62a4f59c1ecf4d82d201402))
* **deploy:** implement tag-based automated deployment system ([b755376](https://github.com/samuelaure/whatsnau/commit/b7553765c47be1d697334ddb607c0b9447a7cb0c))
* **infra:** implement retry logic for db and redis ([12b0fde](https://github.com/samuelaure/whatsnau/commit/12b0fded1296fa16e1ab2d6ad45d88b91782bb62))
* **infra:** standardize docker topology and environment-aware routing ([5ce8c12](https://github.com/samuelaure/whatsnau/commit/5ce8c129c29fd6a6f1b3d0fbfca2e72823a141c2))
* **infra:** sync backend env example with backbone defaults ([137f357](https://github.com/samuelaure/whatsnau/commit/137f357a15d6ba803c266886675091494a441e0d))
* **notifications:** add system alerting capabilities ([654c801](https://github.com/samuelaure/whatsnau/commit/654c80188b1e11ab2d24c82592d1ff15c297accc))
* **observability:** add correlation tracking and performance monitoring ([85c426a](https://github.com/samuelaure/whatsnau/commit/85c426aa473be234866178b9f9d1471be73a2340))
* **observability:** add testing utilities to correlation id module ([c14c716](https://github.com/samuelaure/whatsnau/commit/c14c71682e01ae799694d05433e9f91c216c9408))
* **resilience:** add graceful shutdown, error boundary, and circuit breaker ([a5faea3](https://github.com/samuelaure/whatsnau/commit/a5faea35387ab8487ca96ef7c5e73ae968cd2b1b))
* **resilience:** enhance error boundary and graceful shutdown with http server support ([10451aa](https://github.com/samuelaure/whatsnau/commit/10451aa8cee659e20f99f0caf43953848f14a41a))
* **security:** harden auth, secrets, and cors ([3fdc6f1](https://github.com/samuelaure/whatsnau/commit/3fdc6f1b2c887f191079d34196a81432dbfad07f))
* **services:** add circuit breakers and performance monitoring to ai and whatsapp services ([50872fb](https://github.com/samuelaure/whatsnau/commit/50872fbc2d839e7899f21b54580a458db11c9c46))
* **worker:** implement dedicated worker service ([781e9ed](https://github.com/samuelaure/whatsnau/commit/781e9ed73f2dd61adb53a73b15a7af5ea72ea992))
* **workers:** add error boundaries and retry exhaustion handling ([845e847](https://github.com/samuelaure/whatsnau/commit/845e847b603598dbefa355c453d504a795f511eb))


### Bug Fixes

* **ci:** add config mocking and prisma generation for CI tests ([565a3b5](https://github.com/samuelaure/whatsnau/commit/565a3b5682fcff93cffbc1fc104d3742b3124291))
* **ci:** fix cross-platform env setting and mock infrastructure in tests ([913e5c1](https://github.com/samuelaure/whatsnau/commit/913e5c18bc005f08a2260216e88d410317ee9bc5))
* **frontend:** add array safety checks and fix analytics endpoint ([5e8e8a7](https://github.com/samuelaure/whatsnau/commit/5e8e8a7bfec305f2844c02cdc427b9f09bb6fb7a))
* **security:** enforce tenant-scoping for WhatsApp onboarding ([20db58a](https://github.com/samuelaure/whatsnau/commit/20db58a68b7c54e71589f4ea449afb15d8652bf6))

### [6.6.1](https://github.com/samuelaure/whatsnau/compare/v6.6.0...v6.6.1) (2026-02-05)


### Bug Fixes

* **ci:** fix cross-platform env setting and mock infrastructure in tests ([59c7fe3](https://github.com/samuelaure/whatsnau/commit/59c7fe313dacb516eeb9c068c3e6b3a5cea6a8da))

## [6.6.0](https://github.com/samuelaure/whatsnau/compare/v6.0.0...v6.6.0) (2026-02-05)


### Features

* **api:** add admin and health endpoints ([643e93c](https://github.com/samuelaure/whatsnau/commit/643e93c84d6f2462eb539d655ff371fbc147039e))
* **backend:** add cors and helmet for security hardening ([84c2e37](https://github.com/samuelaure/whatsnau/commit/84c2e37a3f95666a37136686778fde7d996b6775))
* **backend:** add sanitization utility for PII redaction and sensitive data masking ([a7675fc](https://github.com/samuelaure/whatsnau/commit/a7675fc1c09891f74cf00e10fd4cc8d997e3522e))
* **backend:** improve core orchestration type safety and resolve any assertions ([8239123](https://github.com/samuelaure/whatsnau/commit/823912372b4d0f9d8a262bab607321263e6834bb))
* **bootstrap:** integrate resilience features into application startup ([4fd1889](https://github.com/samuelaure/whatsnau/commit/4fd18895322a85deb68a5e12c00950064cf8a4c0))
* **ci:** harden deployment pipeline with quality gates and formal releases ([cfec6be](https://github.com/samuelaure/whatsnau/commit/cfec6bead14c353b23032fa699003c4951531449))
* **config:** add global config service with caching and graceful degradation ([0b32629](https://github.com/samuelaure/whatsnau/commit/0b326291cd6f66e98a4018dd93950790914f46fc))
* **config:** enhance configuration validation and security ([7e576bd](https://github.com/samuelaure/whatsnau/commit/7e576bdbe6cc7a9e017a734e2c56ef90ec5de955))
* **db:** add monitoring models and migration ([0520a5b](https://github.com/samuelaure/whatsnau/commit/0520a5b9a6d6471ce62a4f59c1ecf4d82d201402))
* **deploy:** implement tag-based automated deployment system ([b755376](https://github.com/samuelaure/whatsnau/commit/b7553765c47be1d697334ddb607c0b9447a7cb0c))
* **infra:** implement retry logic for db and redis ([12b0fde](https://github.com/samuelaure/whatsnau/commit/12b0fded1296fa16e1ab2d6ad45d88b91782bb62))
* **notifications:** add system alerting capabilities ([654c801](https://github.com/samuelaure/whatsnau/commit/654c80188b1e11ab2d24c82592d1ff15c297accc))
* **observability:** add correlation tracking and performance monitoring ([85c426a](https://github.com/samuelaure/whatsnau/commit/85c426aa473be234866178b9f9d1471be73a2340))
* **observability:** add testing utilities to correlation id module ([c14c716](https://github.com/samuelaure/whatsnau/commit/c14c71682e01ae799694d05433e9f91c216c9408))
* **resilience:** add graceful shutdown, error boundary, and circuit breaker ([a5faea3](https://github.com/samuelaure/whatsnau/commit/a5faea35387ab8487ca96ef7c5e73ae968cd2b1b))
* **resilience:** enhance error boundary and graceful shutdown with http server support ([10451aa](https://github.com/samuelaure/whatsnau/commit/10451aa8cee659e20f99f0caf43953848f14a41a))
* **services:** add circuit breakers and performance monitoring to ai and whatsapp services ([50872fb](https://github.com/samuelaure/whatsnau/commit/50872fbc2d839e7899f21b54580a458db11c9c46))
* **workers:** add error boundaries and retry exhaustion handling ([845e847](https://github.com/samuelaure/whatsnau/commit/845e847b603598dbefa355c453d504a795f511eb))

## [6.3.0](https://github.com/samuelaure/whatsnau/compare/v6.2.1...v6.3.0) (2026-02-05)

### Chores

* **repo:** implement turborepo orchestration for high-performance task management
* **shared:** standardize package scripts and linting for unified monorepo verification
* **git:** add .turbo to gitignore

## [6.2.1](https://github.com/samuelaure/whatsnau/compare/v6.2.0...v6.2.1) (2026-02-05)

### Chores

* **db:** reset migrations and create consolidated initial release migration


### Features

* **api:** add admin and health endpoints ([643e93c](https://github.com/samuelaure/whatsnau/commit/643e93c84d6f2462eb539d655ff371fbc147039e))
* **backend:** add cors and helmet for security hardening ([84c2e37](https://github.com/samuelaure/whatsnau/commit/84c2e37a3f95666a37136686778fde7d996b6775))
* **backend:** add sanitization utility for PII redaction and sensitive data masking ([a7675fc](https://github.com/samuelaure/whatsnau/commit/a7675fc1c09891f74cf00e10fd4cc8d997e3522e))
* **backend:** improve core orchestration type safety and resolve any assertions ([8239123](https://github.com/samuelaure/whatsnau/commit/823912372b4d0f9d8a262bab607321263e6834bb))
* **bootstrap:** integrate resilience features into application startup ([4fd1889](https://github.com/samuelaure/whatsnau/commit/4fd18895322a85deb68a5e12c00950064cf8a4c0))
* **config:** add global config service with caching and graceful degradation ([0b32629](https://github.com/samuelaure/whatsnau/commit/0b326291cd6f66e98a4018dd93950790914f46fc))
* **config:** enhance configuration validation and security ([7e576bd](https://github.com/samuelaure/whatsnau/commit/7e576bdbe6cc7a9e017a734e2c56ef90ec5de955))
* **db:** add monitoring models and migration ([0520a5b](https://github.com/samuelaure/whatsnau/commit/0520a5b9a6d6471ce62a4f59c1ecf4d82d201402))
* **deploy:** implement tag-based automated deployment system ([b755376](https://github.com/samuelaure/whatsnau/commit/b7553765c47be1d697334ddb607c0b9447a7cb0c))
* **infra:** implement retry logic for db and redis ([12b0fde](https://github.com/samuelaure/whatsnau/commit/12b0fded1296fa16e1ab2d6ad45d88b91782bb62))
* **notifications:** add system alerting capabilities ([654c801](https://github.com/samuelaure/whatsnau/commit/654c80188b1e11ab2d24c82592d1ff15c297accc))
* **observability:** add correlation tracking and performance monitoring ([85c426a](https://github.com/samuelaure/whatsnau/commit/85c426aa473be234866178b9f9d1471be73a2340))
* **observability:** add testing utilities to correlation id module ([c14c716](https://github.com/samuelaure/whatsnau/commit/c14c71682e01ae799694d05433e9f91c216c9408))
* **resilience:** add graceful shutdown, error boundary, and circuit breaker ([a5faea3](https://github.com/samuelaure/whatsnau/commit/a5faea35387ab8487ca96ef7c5e73ae968cd2b1b))
* **resilience:** enhance error boundary and graceful shutdown with http server support ([10451aa](https://github.com/samuelaure/whatsnau/commit/10451aa8cee659e20f99f0caf43953848f14a41a))
* **services:** add circuit breakers and performance monitoring to ai and whatsapp services ([50872fb](https://github.com/samuelaure/whatsnau/commit/50872fbc2d839e7899f21b54580a458db11c9c46))
* **workers:** add error boundaries and retry exhaustion handling ([845e847](https://github.com/samuelaure/whatsnau/commit/845e847b603598dbefa355c453d504a795f511eb))

## [6.1.0](https://github.com/samuelaure/whatsnau/compare/v6.0.0...v6.1.0) (2026-02-03)


### Features

* **deploy:** implement tag-based automated deployment system ([b755376](https://github.com/samuelaure/whatsnau/commit/b7553765c47be1d697334ddb607c0b9447a7cb0c))

## 6.0.0 (2026-02-03)


### ⚠ BREAKING CHANGES

* **schema:** Lead state values changed from OUTREACH/PRE_SALE to COLD/INTERESTED/CLIENTS

### Features

* add business context and dynamic prompt management ([c8ac7c8](https://github.com/samuelaure/whatsnau/commit/c8ac7c8f73fb5a1839a6d4ce43e78bd9470c11f0))
* add dashboard api endpoints and cors support ([65cf5fd](https://github.com/samuelaure/whatsnau/commit/65cf5fd6af12b3c3f65c490e96c5f0fcccb648b0))
* add Docker support for cloud deployment ([c1f7b22](https://github.com/samuelaure/whatsnau/commit/c1f7b22b54be280a8bf0bfb77987faf9c4367b12))
* add Framer Motion for animations ([029fec4](https://github.com/samuelaure/whatsnau/commit/029fec48fa99a10f223b03d9c0c3a3796a43d389))
* add global real-time system logs monitoring ([0f2796a](https://github.com/samuelaure/whatsnau/commit/0f2796a47a08df05a851d4475d2e35ae4808f231))
* add Nurturing Buddy agent and enhance prompt editing UX ([f5100ab](https://github.com/samuelaure/whatsnau/commit/f5100abb01f18c97a5dc70acf34a6967a33056a7))
* add postgres migrations ([b62df3e](https://github.com/samuelaure/whatsnau/commit/b62df3e2726729ba9ad7a17992e7f7e9ee90ccc3))
* **ai:** implement context injection for personalized AI responses ([4c9d2c0](https://github.com/samuelaure/whatsnau/commit/4c9d2c0d5187a97782f1f3f578b39d34fa5bbdc5))
* **ai:** implement retrieval service and optimize conversation context ([f13f925](https://github.com/samuelaure/whatsnau/commit/f13f92517ec9c19d5c6bf7c06e3a703fe5ef6930))
* **ai:** support multiple tool calls in AIService ([912a13a](https://github.com/samuelaure/whatsnau/commit/912a13a8cd6193aa56e05be798e235c34056d41d))
* **analytics:** add Predictive Analytics dashboard with funnel visualization ([e467d68](https://github.com/samuelaure/whatsnau/commit/e467d68b910d50877ce367b1510c188675fe65de))
* **api:** add configuration endpoints for keywords and recovery settings ([1953259](https://github.com/samuelaure/whatsnau/commit/19532595fe6408fc9f5151c5f37b7c5c156a0975))
* **api:** implement dashboard metrics and pipeline data endpoints ([56f637c](https://github.com/samuelaure/whatsnau/commit/56f637c9f2a8c99ab15627cf31a792e460ae38a1))
* **backend:** implement whatsapp provider abstraction and ycloud stub ([8789a6c](https://github.com/samuelaure/whatsnau/commit/8789a6cb20c744044ed2e25f64f6ee653277259d))
* **backend:** implement whatsapp provider abstraction and ycloud stub ([43530af](https://github.com/samuelaure/whatsnau/commit/43530afc9d46758b57b6d71cf5c7c43dd668d597))
* **backend:** implement ycloud webhook signature verification and normalization ([2e454d5](https://github.com/samuelaure/whatsnau/commit/2e454d509271b07ab341aaf9d8915017dcd0e330))
* complete whatsapp embedded signup with database persistence ([57a076e](https://github.com/samuelaure/whatsnau/commit/57a076e037a41526792be9a4663607c913d37562))
* **compliance:** implement anti-spam limits and cost optimization ([962c518](https://github.com/samuelaure/whatsnau/commit/962c5187fde2a6cca198574bf8d85197df81e4d1))
* **compliance:** implement smart WhatsApp template routing ([3973727](https://github.com/samuelaure/whatsnau/commit/3973727270f5bfd81c075085414bf2a871f77c37))
* **core:** implement multi-tenancy architecture and SEO enhancements ([b1bd60a](https://github.com/samuelaure/whatsnau/commit/b1bd60a9299bb7937489f9b36e971755432d798d)), closes [#3b0764](https://github.com/samuelaure/whatsnau/issues/3b0764)
* create reusable UI components and data fetching utilities ([5b58b80](https://github.com/samuelaure/whatsnau/commit/5b58b80906fe403d5404257d2f3afae0aad3e905))
* **crm:** complete sales automation and recovery logic ([05e18b8](https://github.com/samuelaure/whatsnau/commit/05e18b867b382130e6c4bb15980563e935a6796c))
* **crm:** implement recovery worker and sales automation tool ([956b2f6](https://github.com/samuelaure/whatsnau/commit/956b2f69b054b508881096080edf8bbd5a67860c))
* **dashboard:** add lead state segmentation visualization ([107f95b](https://github.com/samuelaure/whatsnau/commit/107f95b30f579d9595d6cfae2bdc96276108b6d3))
* enforce campaign-aware lead import ([ee2f968](https://github.com/samuelaure/whatsnau/commit/ee2f96822373cbae451507908066ccd1e91f4ab0))
* enhance outreach engine with deep analytics and real-time alerts v0.5.0 / 0.4.0 ([81de291](https://github.com/samuelaure/whatsnau/commit/81de291dc85e59d3989b27c2224811439377aeb0))
* enhance production security and update admin profile ([b1b467b](https://github.com/samuelaure/whatsnau/commit/b1b467bae6757199de1b969e75bfa9d4db6c87b6))
* enhance service resilience and controller robustness ([7bca291](https://github.com/samuelaure/whatsnau/commit/7bca29188b61265d7dbe35001ed24cbd99b793c5))
* **frontend:** modernize stack with tailwind and framer motion ([8c72e21](https://github.com/samuelaure/whatsnau/commit/8c72e2183821ff91f6906aa7c86ada6128c5c6a8))
* implement campaign and lead services with database seeding ([f46835e](https://github.com/samuelaure/whatsnau/commit/f46835ed2d92eff8c27fda4235dc8357c05ad3a1))
* implement campaign orchestrator and state transitions ([24c0aa1](https://github.com/samuelaure/whatsnau/commit/24c0aa17797c356cc5e6a3df3239d9df3db8cb38))
* implement campaign-scoped workspaces across core services and UI ([ca9e7f2](https://github.com/samuelaure/whatsnau/commit/ca9e7f2c234c577a3930cf1cd034a6c82a3bc9b5))
* implement campaign-scoped workspaces and sidebar navigation ([8c8b92c](https://github.com/samuelaure/whatsnau/commit/8c8b92cc3dc545461270063b6f801e64908316f0))
* implement comprehensive authentication and security layer ([7cb2fa6](https://github.com/samuelaure/whatsnau/commit/7cb2fa696657b67c05df26247788bffdaadd0c0f))
* implement comprehensive webhook logging for all WhatsApp events ([41f2029](https://github.com/samuelaure/whatsnau/commit/41f2029754906e4002221854729b11ea8285cbd8))
* implement conversational pre-sale and live demo logic ([e8e9e31](https://github.com/samuelaure/whatsnau/commit/e8e9e31b0c1e3f8fb800e9e67511ada92a21c807))
* implement customizable human handover triggers ([127d680](https://github.com/samuelaure/whatsnau/commit/127d680b04e20fdfdb203912e9b6379b692ffbb7))
* implement frontend resilience and user feedback system ([6e5a251](https://github.com/samuelaure/whatsnau/commit/6e5a251d5b797da21f04ed689a679bbe3a8b2035))
* implement global error handling infrastructure ([78d9883](https://github.com/samuelaure/whatsnau/commit/78d9883ced700cda11a558644f9e2c262e24a511))
* implement human-in-the-loop takeover logic ([a2d102b](https://github.com/samuelaure/whatsnau/commit/a2d102be7b233439dc0bdb5633e881cc8a417f73))
* implement intelligent message grouping (debouncing) ([d9418e0](https://github.com/samuelaure/whatsnau/commit/d9418e06598950ac206edfe6ef7630261338b35c))
* implement intelligent multi-tier handover system ([068d556](https://github.com/samuelaure/whatsnau/commit/068d5564e1db074fad661ad0dda853efcd035775))
* implement live chat across dashboard ([5afc5e0](https://github.com/samuelaure/whatsnau/commit/5afc5e06f792597cae72be69d97d0f63f7f5893a))
* implement mass outreach engine backend and telegram alerts ([79c8c32](https://github.com/samuelaure/whatsnau/commit/79c8c323a2f130e5df63465ebd733c9cfe4b4a6d))
* implement mass outreach import and refine UI ([bc2a046](https://github.com/samuelaure/whatsnau/commit/bc2a046e8e9dd473a51819ee62e99a42c2d6dc46))
* implement message status tracking ([d78e440](https://github.com/samuelaure/whatsnau/commit/d78e440800480acc40331ef8d60c44904fd5b785))
* implement pagination for list endpoints ([3bf7b79](https://github.com/samuelaure/whatsnau/commit/3bf7b79190991828d492b5a90ac422fb50863560))
* implement premium dashboard UI with react and vite ([c9fcd93](https://github.com/samuelaure/whatsnau/commit/c9fcd9383b746ff553cabd87aed1207c721feaae))
* implement real-time SSE events, AI toggle, and template management ([26beb6b](https://github.com/samuelaure/whatsnau/commit/26beb6b5ac2118f10712b5ab56ca74e9a326f8db))
* implement sequence processing and metrics tracking ([82988a0](https://github.com/samuelaure/whatsnau/commit/82988a0387191dfca51b673562cbc07e881618dd))
* implement streaming CSV import and SHA-256 deduplication ([3a41cfd](https://github.com/samuelaure/whatsnau/commit/3a41cfd787b53ce4e4dd8da9e9549e9cd4c8942c))
* implement testing infrastructure and observability health check ([98fdf77](https://github.com/samuelaure/whatsnau/commit/98fdf7709d84ad7992a56627a2773a5bc5ef157e))
* implement toggleable sidebar and fix backend prisma seeding ([0d95cba](https://github.com/samuelaure/whatsnau/commit/0d95cba0a0cc946fba33a339a10b7cbe89d9e718))
* implement whatsapp embedded signup flow ([9a919c5](https://github.com/samuelaure/whatsnau/commit/9a919c5044af33cef397ec13f63e723c0c1189fd))
* implement whatsapp gateway, ai orchestration core, and webhook hub ([6727d22](https://github.com/samuelaure/whatsnau/commit/6727d22a8af34f767eda2b90dbcb021b2098b528))
* **import:** add inline campaign creation for streamlined workflow ([ff7c8cc](https://github.com/samuelaure/whatsnau/commit/ff7c8ccb37e84a24b594a81608525da191a858fd))
* **infra:** implement queue-based messaging and webhook processing ([a749aae](https://github.com/samuelaure/whatsnau/commit/a749aaec5c58f5aca6e38d32e7cdde47e56f6280))
* initialize project structure and core prisma schema ([3a29c2f](https://github.com/samuelaure/whatsnau/commit/3a29c2fa744259379030d64f084433c4058b0545))
* install meta facebook sdk for whatsapp embedded signup ([278ef15](https://github.com/samuelaure/whatsnau/commit/278ef15820a7986158181c77335002beaa5953a6))
* integrate TailwindCSS into frontend ([3762792](https://github.com/samuelaure/whatsnau/commit/3762792ab8876f9fb8ef1568c041f014b8e65693))
* integrate TanStack Query for data fetching ([9c30d37](https://github.com/samuelaure/whatsnau/commit/9c30d3769018f14348f375516b20eb50c4596631))
* intelligent WhatsApp account detection for reconnect flow ([acb78a9](https://github.com/samuelaure/whatsnau/commit/acb78a90cd10062430818573e559f5f6f8fec346))
* migrate to PostgreSQL for production stability ([cf8eecb](https://github.com/samuelaure/whatsnau/commit/cf8eecb3b4eca0b001e31fbd68c61ef0596dcaab))
* **orchestrator:** implement complete platform v2 state machine and sequences ([43b2023](https://github.com/samuelaure/whatsnau/commit/43b202322ff04fc26892634faf40206958452e3e))
* production hardening and automated server deployment ([f028671](https://github.com/samuelaure/whatsnau/commit/f02867145f48ffbc56df3df455eaadded95bb2c1))
* **recovery:** transition to event-driven lead recovery using BullMQ ([47ab40e](https://github.com/samuelaure/whatsnau/commit/47ab40ef4a558dbe1f65b049ec5ecfcbd6cde7cb))
* refactor frontend into modular components and custom hooks ([550026f](https://github.com/samuelaure/whatsnau/commit/550026fe4c907f4a7df173320bb1fb9f123bfe28))
* **schema:** add products and orders to prisma schema ([66db1f0](https://github.com/samuelaure/whatsnau/commit/66db1f0a064e643b469995a61d8d39c7258c0966))
* **schema:** add WhatsApp template database integration ([86b09f7](https://github.com/samuelaure/whatsnau/commit/86b09f776af6532261f1c67b0646f5f88996c5e9))
* **schema:** implement platform v2 database schema ([3040db9](https://github.com/samuelaure/whatsnau/commit/3040db922d072359addd1914df15a02b32fdea80))
* **seed:** add comprehensive platform v2 seed data ([7cd49b6](https://github.com/samuelaure/whatsnau/commit/7cd49b62abc5a49db05ae09f61e3db4acdb82be6))
* serve static frontend from backend and specify SPA fallback ([b4a4afd](https://github.com/samuelaure/whatsnau/commit/b4a4afde7e8cbc53b1f1ca327ca0fa04a828fd07))
* **services:** implement LeadService v2 and TemplateService ([55405b3](https://github.com/samuelaure/whatsnau/commit/55405b3f95513a04b2e4755743ac4395e6d5bed7))
* setup project foundation with typescript, prisma, and logging ([60ada7c](https://github.com/samuelaure/whatsnau/commit/60ada7cb7c358a6ae2fead016964e571988182d7))
* **templates:** add template sync service and smart sending logic ([9810263](https://github.com/samuelaure/whatsnau/commit/9810263eacb733650f443b13b49645bf23e9d21b))
* **ui:** add Broadcast System for targeted mass messaging ([15d342e](https://github.com/samuelaure/whatsnau/commit/15d342ee6db3cbff882d5f1c78da5eb60af10a79))
* **ui:** add comprehensive Campaign Manager with CRUD operations ([fa12403](https://github.com/samuelaure/whatsnau/commit/fa124039891fdbdb6ae849a715fdd36b1209908e))
* **ui:** add WhatsApp template linking and sync UI ([af010dd](https://github.com/samuelaure/whatsnau/commit/af010dd6a2a048e20d0e105a3ea42ddfd8ca792c))
* **ui:** implement dashboard overview and visual pipeline board ([b294472](https://github.com/samuelaure/whatsnau/commit/b294472e866a0c1f319d703a88587be50ea8e08b))
* **ui:** implement GDPR-compliant Privacy Policy ([1f6d9c9](https://github.com/samuelaure/whatsnau/commit/1f6d9c935bd2706ae97f169f0444d52c6c10d2fb))
* **ui:** implement visual node-based workflow builder with DAG architecture ([f0515d9](https://github.com/samuelaure/whatsnau/commit/f0515d9554ef0cedc526bab3edfa70135883ba36))
* update frontend to handle paginated API responses ([9b04285](https://github.com/samuelaure/whatsnau/commit/9b04285810f53310e5ad9a1ae94a2008cbb996d1))
* **whatsapp:** add interactive buttons and list support ([b1b6b45](https://github.com/samuelaure/whatsnau/commit/b1b6b454a0ac457cfaf945f41badae6c2aa3185f))
* **whatsapp:** implement direction detection and automatic handover ([0b869c0](https://github.com/samuelaure/whatsnau/commit/0b869c0ee8ac8e3373681945bc10661f1e7b15e2))


### Bug Fixes

* add fallback polling for Facebook login status after popup closes ([606b225](https://github.com/samuelaure/whatsnau/commit/606b225dd31c1fcca7953ab746e59f3bc9cad815))
* align Embedded Signup with Meta docs and resolve dashboard 502 loop ([3e2e31b](https://github.com/samuelaure/whatsnau/commit/3e2e31ba0349d4a1de50d54b655342901d32d4c8))
* **auth:** fix login credentials inconsistency and vite proxy configuration ([910f05b](https://github.com/samuelaure/whatsnau/commit/910f05b3b4c539f7371bb8064b54207eeb492b9a))
* **auth:** fix session persistence and cookie handling ([55c62e1](https://github.com/samuelaure/whatsnau/commit/55c62e1e9947ac4c6c7377314e997d77d76a94e9))
* configure CSP to allow Facebook SDK and add debugging ([7752652](https://github.com/samuelaure/whatsnau/commit/7752652db2452662186a529837f516b67ba3a6cf))
* **core:** refactor orchestrator for strict multi-tenancy lead resolution ([053a947](https://github.com/samuelaure/whatsnau/commit/053a947f7c4d825bc23712d74ce03448581d4f2a))
* **core:** resolve strict build errors for multi-tenancy ([c07e633](https://github.com/samuelaure/whatsnau/commit/c07e633bff724ef8b17992fd86592a6a7e3e674f))
* **deploy:** robust healthcheck for postgres ([1325098](https://github.com/samuelaure/whatsnau/commit/13250989cc9d9a8c39fb476ba711ffd95bfb9bd8))
* enable sidebar scrolling for split-screen workflows ([dfd4c58](https://github.com/samuelaure/whatsnau/commit/dfd4c58884f9b8f810e4bc68c23f2544a2b70a60))
* ignore initial 'unknown' status from Facebook SDK callback ([75adf7f](https://github.com/samuelaure/whatsnau/commit/75adf7f919d511549ce2db0fe22d20253b3ead8f))
* **prisma:** reorder migrations to correct dependency sequence ([ec50475](https://github.com/samuelaure/whatsnau/commit/ec5047589005207b221628612a8f545c4dfffcec))
* **prisma:** reset migrations ([178c9f4](https://github.com/samuelaure/whatsnau/commit/178c9f49b5a8b626abe4845e0d37de1e9c8114aa))
* resolve async callback issue in Facebook login handler ([2a6e8f3](https://github.com/samuelaure/whatsnau/commit/2a6e8f35b778e9592973ffa2fced3fbe7ca5e784))
* resolve SSE headers error and dynamic Meta SDK initialization ([7db41fe](https://github.com/samuelaure/whatsnau/commit/7db41fee1f32a407c8b14216ff86c0ca52ac1c5b))
* **security:** implement multi-tenant isolation for keywords and orders ([90270b3](https://github.com/samuelaure/whatsnau/commit/90270b3fe2ffd0916481a3c62767ce39582e0520))
* switch extras object to camelCase ([1783712](https://github.com/samuelaure/whatsnau/commit/17837122731a25d0bf870786ecac5acc31b69a64))
* **tenancy:** sync schema drift and improve seed robustness ([00ff6df](https://github.com/samuelaure/whatsnau/commit/00ff6df2248f4d91faac28da577f2570f6a6de74))
* **ui:** fix CORS and session issues by using relative API paths ([5724124](https://github.com/samuelaure/whatsnau/commit/5724124a3321563dd6c350f5cc0bcae79bb69bee))
* **webhook:** align endpoint with documentation and meta dashboard ([5390d44](https://github.com/samuelaure/whatsnau/commit/5390d445656982962cea5c0bdcceebacd72f2074))
* **whatsapp:** add redirect_uri to embedded signup OAuth flow ([ffe83c8](https://github.com/samuelaure/whatsnau/commit/ffe83c8c0f3449478fc690f8da6190e450d26a38))
* **whatsapp:** prevent API spam when account not paired ([447052c](https://github.com/samuelaure/whatsnau/commit/447052c2efffc0494400f0c65efc83fdc100c7fd))

## 5.0.0 (2026-02-03)


### ⚠ BREAKING CHANGES

* **schema:** Lead state values changed from OUTREACH/PRE_SALE to COLD/INTERESTED/CLIENTS

### Features

* add business context and dynamic prompt management ([c8ac7c8](https://github.com/samuelaure/whatsnau/commit/c8ac7c8f73fb5a1839a6d4ce43e78bd9470c11f0))
* add dashboard api endpoints and cors support ([65cf5fd](https://github.com/samuelaure/whatsnau/commit/65cf5fd6af12b3c3f65c490e96c5f0fcccb648b0))
* add Docker support for cloud deployment ([c1f7b22](https://github.com/samuelaure/whatsnau/commit/c1f7b22b54be280a8bf0bfb77987faf9c4367b12))
* add Framer Motion for animations ([029fec4](https://github.com/samuelaure/whatsnau/commit/029fec48fa99a10f223b03d9c0c3a3796a43d389))
* add global real-time system logs monitoring ([0f2796a](https://github.com/samuelaure/whatsnau/commit/0f2796a47a08df05a851d4475d2e35ae4808f231))
* add Nurturing Buddy agent and enhance prompt editing UX ([f5100ab](https://github.com/samuelaure/whatsnau/commit/f5100abb01f18c97a5dc70acf34a6967a33056a7))
* add postgres migrations ([b62df3e](https://github.com/samuelaure/whatsnau/commit/b62df3e2726729ba9ad7a17992e7f7e9ee90ccc3))
* **ai:** implement context injection for personalized AI responses ([4c9d2c0](https://github.com/samuelaure/whatsnau/commit/4c9d2c0d5187a97782f1f3f578b39d34fa5bbdc5))
* **ai:** implement retrieval service and optimize conversation context ([f13f925](https://github.com/samuelaure/whatsnau/commit/f13f92517ec9c19d5c6bf7c06e3a703fe5ef6930))
* **analytics:** add Predictive Analytics dashboard with funnel visualization ([e467d68](https://github.com/samuelaure/whatsnau/commit/e467d68b910d50877ce367b1510c188675fe65de))
* **api:** add configuration endpoints for keywords and recovery settings ([1953259](https://github.com/samuelaure/whatsnau/commit/19532595fe6408fc9f5151c5f37b7c5c156a0975))
* **backend:** implement whatsapp provider abstraction and ycloud stub ([8789a6c](https://github.com/samuelaure/whatsnau/commit/8789a6cb20c744044ed2e25f64f6ee653277259d))
* **backend:** implement whatsapp provider abstraction and ycloud stub ([43530af](https://github.com/samuelaure/whatsnau/commit/43530afc9d46758b57b6d71cf5c7c43dd668d597))
* **backend:** implement ycloud webhook signature verification and normalization ([2e454d5](https://github.com/samuelaure/whatsnau/commit/2e454d509271b07ab341aaf9d8915017dcd0e330))
* complete whatsapp embedded signup with database persistence ([57a076e](https://github.com/samuelaure/whatsnau/commit/57a076e037a41526792be9a4663607c913d37562))
* **compliance:** implement anti-spam limits and cost optimization ([962c518](https://github.com/samuelaure/whatsnau/commit/962c5187fde2a6cca198574bf8d85197df81e4d1))
* **compliance:** implement smart WhatsApp template routing ([3973727](https://github.com/samuelaure/whatsnau/commit/3973727270f5bfd81c075085414bf2a871f77c37))
* **core:** implement multi-tenancy architecture and SEO enhancements ([b1bd60a](https://github.com/samuelaure/whatsnau/commit/b1bd60a9299bb7937489f9b36e971755432d798d)), closes [#3b0764](https://github.com/samuelaure/whatsnau/issues/3b0764)
* create reusable UI components and data fetching utilities ([5b58b80](https://github.com/samuelaure/whatsnau/commit/5b58b80906fe403d5404257d2f3afae0aad3e905))
* **crm:** complete sales automation and recovery logic ([05e18b8](https://github.com/samuelaure/whatsnau/commit/05e18b867b382130e6c4bb15980563e935a6796c))
* **crm:** implement recovery worker and sales automation tool ([956b2f6](https://github.com/samuelaure/whatsnau/commit/956b2f69b054b508881096080edf8bbd5a67860c))
* **dashboard:** add lead state segmentation visualization ([107f95b](https://github.com/samuelaure/whatsnau/commit/107f95b30f579d9595d6cfae2bdc96276108b6d3))
* enforce campaign-aware lead import ([ee2f968](https://github.com/samuelaure/whatsnau/commit/ee2f96822373cbae451507908066ccd1e91f4ab0))
* enhance outreach engine with deep analytics and real-time alerts v0.5.0 / 0.4.0 ([81de291](https://github.com/samuelaure/whatsnau/commit/81de291dc85e59d3989b27c2224811439377aeb0))
* enhance production security and update admin profile ([b1b467b](https://github.com/samuelaure/whatsnau/commit/b1b467bae6757199de1b969e75bfa9d4db6c87b6))
* enhance service resilience and controller robustness ([7bca291](https://github.com/samuelaure/whatsnau/commit/7bca29188b61265d7dbe35001ed24cbd99b793c5))
* **frontend:** modernize stack with tailwind and framer motion ([8c72e21](https://github.com/samuelaure/whatsnau/commit/8c72e2183821ff91f6906aa7c86ada6128c5c6a8))
* implement campaign and lead services with database seeding ([f46835e](https://github.com/samuelaure/whatsnau/commit/f46835ed2d92eff8c27fda4235dc8357c05ad3a1))
* implement campaign orchestrator and state transitions ([24c0aa1](https://github.com/samuelaure/whatsnau/commit/24c0aa17797c356cc5e6a3df3239d9df3db8cb38))
* implement campaign-scoped workspaces across core services and UI ([ca9e7f2](https://github.com/samuelaure/whatsnau/commit/ca9e7f2c234c577a3930cf1cd034a6c82a3bc9b5))
* implement campaign-scoped workspaces and sidebar navigation ([8c8b92c](https://github.com/samuelaure/whatsnau/commit/8c8b92cc3dc545461270063b6f801e64908316f0))
* implement comprehensive authentication and security layer ([7cb2fa6](https://github.com/samuelaure/whatsnau/commit/7cb2fa696657b67c05df26247788bffdaadd0c0f))
* implement comprehensive webhook logging for all WhatsApp events ([41f2029](https://github.com/samuelaure/whatsnau/commit/41f2029754906e4002221854729b11ea8285cbd8))
* implement conversational pre-sale and live demo logic ([e8e9e31](https://github.com/samuelaure/whatsnau/commit/e8e9e31b0c1e3f8fb800e9e67511ada92a21c807))
* implement customizable human handover triggers ([127d680](https://github.com/samuelaure/whatsnau/commit/127d680b04e20fdfdb203912e9b6379b692ffbb7))
* implement frontend resilience and user feedback system ([6e5a251](https://github.com/samuelaure/whatsnau/commit/6e5a251d5b797da21f04ed689a679bbe3a8b2035))
* implement global error handling infrastructure ([78d9883](https://github.com/samuelaure/whatsnau/commit/78d9883ced700cda11a558644f9e2c262e24a511))
* implement human-in-the-loop takeover logic ([a2d102b](https://github.com/samuelaure/whatsnau/commit/a2d102be7b233439dc0bdb5633e881cc8a417f73))
* implement intelligent message grouping (debouncing) ([d9418e0](https://github.com/samuelaure/whatsnau/commit/d9418e06598950ac206edfe6ef7630261338b35c))
* implement intelligent multi-tier handover system ([068d556](https://github.com/samuelaure/whatsnau/commit/068d5564e1db074fad661ad0dda853efcd035775))
* implement live chat across dashboard ([5afc5e0](https://github.com/samuelaure/whatsnau/commit/5afc5e06f792597cae72be69d97d0f63f7f5893a))
* implement mass outreach engine backend and telegram alerts ([79c8c32](https://github.com/samuelaure/whatsnau/commit/79c8c323a2f130e5df63465ebd733c9cfe4b4a6d))
* implement mass outreach import and refine UI ([bc2a046](https://github.com/samuelaure/whatsnau/commit/bc2a046e8e9dd473a51819ee62e99a42c2d6dc46))
* implement message status tracking ([d78e440](https://github.com/samuelaure/whatsnau/commit/d78e440800480acc40331ef8d60c44904fd5b785))
* implement pagination for list endpoints ([3bf7b79](https://github.com/samuelaure/whatsnau/commit/3bf7b79190991828d492b5a90ac422fb50863560))
* implement premium dashboard UI with react and vite ([c9fcd93](https://github.com/samuelaure/whatsnau/commit/c9fcd9383b746ff553cabd87aed1207c721feaae))
* implement real-time SSE events, AI toggle, and template management ([26beb6b](https://github.com/samuelaure/whatsnau/commit/26beb6b5ac2118f10712b5ab56ca74e9a326f8db))
* implement sequence processing and metrics tracking ([82988a0](https://github.com/samuelaure/whatsnau/commit/82988a0387191dfca51b673562cbc07e881618dd))
* implement streaming CSV import and SHA-256 deduplication ([3a41cfd](https://github.com/samuelaure/whatsnau/commit/3a41cfd787b53ce4e4dd8da9e9549e9cd4c8942c))
* implement testing infrastructure and observability health check ([98fdf77](https://github.com/samuelaure/whatsnau/commit/98fdf7709d84ad7992a56627a2773a5bc5ef157e))
* implement toggleable sidebar and fix backend prisma seeding ([0d95cba](https://github.com/samuelaure/whatsnau/commit/0d95cba0a0cc946fba33a339a10b7cbe89d9e718))
* implement whatsapp embedded signup flow ([9a919c5](https://github.com/samuelaure/whatsnau/commit/9a919c5044af33cef397ec13f63e723c0c1189fd))
* implement whatsapp gateway, ai orchestration core, and webhook hub ([6727d22](https://github.com/samuelaure/whatsnau/commit/6727d22a8af34f767eda2b90dbcb021b2098b528))
* **import:** add inline campaign creation for streamlined workflow ([ff7c8cc](https://github.com/samuelaure/whatsnau/commit/ff7c8ccb37e84a24b594a81608525da191a858fd))
* **infra:** implement queue-based messaging and webhook processing ([a749aae](https://github.com/samuelaure/whatsnau/commit/a749aaec5c58f5aca6e38d32e7cdde47e56f6280))
* initialize project structure and core prisma schema ([3a29c2f](https://github.com/samuelaure/whatsnau/commit/3a29c2fa744259379030d64f084433c4058b0545))
* install meta facebook sdk for whatsapp embedded signup ([278ef15](https://github.com/samuelaure/whatsnau/commit/278ef15820a7986158181c77335002beaa5953a6))
* integrate TailwindCSS into frontend ([3762792](https://github.com/samuelaure/whatsnau/commit/3762792ab8876f9fb8ef1568c041f014b8e65693))
* integrate TanStack Query for data fetching ([9c30d37](https://github.com/samuelaure/whatsnau/commit/9c30d3769018f14348f375516b20eb50c4596631))
* intelligent WhatsApp account detection for reconnect flow ([acb78a9](https://github.com/samuelaure/whatsnau/commit/acb78a90cd10062430818573e559f5f6f8fec346))
* migrate to PostgreSQL for production stability ([cf8eecb](https://github.com/samuelaure/whatsnau/commit/cf8eecb3b4eca0b001e31fbd68c61ef0596dcaab))
* **orchestrator:** implement complete platform v2 state machine and sequences ([43b2023](https://github.com/samuelaure/whatsnau/commit/43b202322ff04fc26892634faf40206958452e3e))
* production hardening and automated server deployment ([f028671](https://github.com/samuelaure/whatsnau/commit/f02867145f48ffbc56df3df455eaadded95bb2c1))
* refactor frontend into modular components and custom hooks ([550026f](https://github.com/samuelaure/whatsnau/commit/550026fe4c907f4a7df173320bb1fb9f123bfe28))
* **schema:** add products and orders to prisma schema ([66db1f0](https://github.com/samuelaure/whatsnau/commit/66db1f0a064e643b469995a61d8d39c7258c0966))
* **schema:** add WhatsApp template database integration ([86b09f7](https://github.com/samuelaure/whatsnau/commit/86b09f776af6532261f1c67b0646f5f88996c5e9))
* **schema:** implement platform v2 database schema ([3040db9](https://github.com/samuelaure/whatsnau/commit/3040db922d072359addd1914df15a02b32fdea80))
* **seed:** add comprehensive platform v2 seed data ([7cd49b6](https://github.com/samuelaure/whatsnau/commit/7cd49b62abc5a49db05ae09f61e3db4acdb82be6))
* serve static frontend from backend and specify SPA fallback ([b4a4afd](https://github.com/samuelaure/whatsnau/commit/b4a4afde7e8cbc53b1f1ca327ca0fa04a828fd07))
* **services:** implement LeadService v2 and TemplateService ([55405b3](https://github.com/samuelaure/whatsnau/commit/55405b3f95513a04b2e4755743ac4395e6d5bed7))
* setup project foundation with typescript, prisma, and logging ([60ada7c](https://github.com/samuelaure/whatsnau/commit/60ada7cb7c358a6ae2fead016964e571988182d7))
* **templates:** add template sync service and smart sending logic ([9810263](https://github.com/samuelaure/whatsnau/commit/9810263eacb733650f443b13b49645bf23e9d21b))
* **ui:** add Broadcast System for targeted mass messaging ([15d342e](https://github.com/samuelaure/whatsnau/commit/15d342ee6db3cbff882d5f1c78da5eb60af10a79))
* **ui:** add comprehensive Campaign Manager with CRUD operations ([fa12403](https://github.com/samuelaure/whatsnau/commit/fa124039891fdbdb6ae849a715fdd36b1209908e))
* **ui:** add WhatsApp template linking and sync UI ([af010dd](https://github.com/samuelaure/whatsnau/commit/af010dd6a2a048e20d0e105a3ea42ddfd8ca792c))
* **ui:** implement GDPR-compliant Privacy Policy ([1f6d9c9](https://github.com/samuelaure/whatsnau/commit/1f6d9c935bd2706ae97f169f0444d52c6c10d2fb))
* **ui:** implement visual node-based workflow builder with DAG architecture ([f0515d9](https://github.com/samuelaure/whatsnau/commit/f0515d9554ef0cedc526bab3edfa70135883ba36))
* update frontend to handle paginated API responses ([9b04285](https://github.com/samuelaure/whatsnau/commit/9b04285810f53310e5ad9a1ae94a2008cbb996d1))
* **whatsapp:** add interactive buttons and list support ([b1b6b45](https://github.com/samuelaure/whatsnau/commit/b1b6b454a0ac457cfaf945f41badae6c2aa3185f))
* **whatsapp:** implement direction detection and automatic handover ([0b869c0](https://github.com/samuelaure/whatsnau/commit/0b869c0ee8ac8e3373681945bc10661f1e7b15e2))


### Bug Fixes

* add fallback polling for Facebook login status after popup closes ([606b225](https://github.com/samuelaure/whatsnau/commit/606b225dd31c1fcca7953ab746e59f3bc9cad815))
* align Embedded Signup with Meta docs and resolve dashboard 502 loop ([3e2e31b](https://github.com/samuelaure/whatsnau/commit/3e2e31ba0349d4a1de50d54b655342901d32d4c8))
* **auth:** fix login credentials inconsistency and vite proxy configuration ([910f05b](https://github.com/samuelaure/whatsnau/commit/910f05b3b4c539f7371bb8064b54207eeb492b9a))
* **auth:** fix session persistence and cookie handling ([55c62e1](https://github.com/samuelaure/whatsnau/commit/55c62e1e9947ac4c6c7377314e997d77d76a94e9))
* configure CSP to allow Facebook SDK and add debugging ([7752652](https://github.com/samuelaure/whatsnau/commit/7752652db2452662186a529837f516b67ba3a6cf))
* **core:** refactor orchestrator for strict multi-tenancy lead resolution ([053a947](https://github.com/samuelaure/whatsnau/commit/053a947f7c4d825bc23712d74ce03448581d4f2a))
* **core:** resolve strict build errors for multi-tenancy ([c07e633](https://github.com/samuelaure/whatsnau/commit/c07e633bff724ef8b17992fd86592a6a7e3e674f))
* **deploy:** robust healthcheck for postgres ([1325098](https://github.com/samuelaure/whatsnau/commit/13250989cc9d9a8c39fb476ba711ffd95bfb9bd8))
* enable sidebar scrolling for split-screen workflows ([dfd4c58](https://github.com/samuelaure/whatsnau/commit/dfd4c58884f9b8f810e4bc68c23f2544a2b70a60))
* ignore initial 'unknown' status from Facebook SDK callback ([75adf7f](https://github.com/samuelaure/whatsnau/commit/75adf7f919d511549ce2db0fe22d20253b3ead8f))
* **prisma:** reorder migrations to correct dependency sequence ([ec50475](https://github.com/samuelaure/whatsnau/commit/ec5047589005207b221628612a8f545c4dfffcec))
* **prisma:** reset migrations ([178c9f4](https://github.com/samuelaure/whatsnau/commit/178c9f49b5a8b626abe4845e0d37de1e9c8114aa))
* resolve async callback issue in Facebook login handler ([2a6e8f3](https://github.com/samuelaure/whatsnau/commit/2a6e8f35b778e9592973ffa2fced3fbe7ca5e784))
* resolve SSE headers error and dynamic Meta SDK initialization ([7db41fe](https://github.com/samuelaure/whatsnau/commit/7db41fee1f32a407c8b14216ff86c0ca52ac1c5b))
* switch extras object to camelCase ([1783712](https://github.com/samuelaure/whatsnau/commit/17837122731a25d0bf870786ecac5acc31b69a64))
* **tenancy:** sync schema drift and improve seed robustness ([00ff6df](https://github.com/samuelaure/whatsnau/commit/00ff6df2248f4d91faac28da577f2570f6a6de74))
* **ui:** fix CORS and session issues by using relative API paths ([5724124](https://github.com/samuelaure/whatsnau/commit/5724124a3321563dd6c350f5cc0bcae79bb69bee))
* **webhook:** align endpoint with documentation and meta dashboard ([5390d44](https://github.com/samuelaure/whatsnau/commit/5390d445656982962cea5c0bdcceebacd72f2074))
* **whatsapp:** add redirect_uri to embedded signup OAuth flow ([ffe83c8](https://github.com/samuelaure/whatsnau/commit/ffe83c8c0f3449478fc690f8da6190e450d26a38))
* **whatsapp:** prevent API spam when account not paired ([447052c](https://github.com/samuelaure/whatsnau/commit/447052c2efffc0494400f0c65efc83fdc100c7fd))
