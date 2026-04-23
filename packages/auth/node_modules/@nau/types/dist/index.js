"use strict";
// ── Enums ──────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptType = exports.PromptOwnerType = exports.SocialProfileRole = exports.SocialPlatform = exports.WorkspaceRole = void 0;
var WorkspaceRole;
(function (WorkspaceRole) {
    WorkspaceRole["OWNER"] = "OWNER";
    WorkspaceRole["ADMIN"] = "ADMIN";
    WorkspaceRole["MEMBER"] = "MEMBER";
})(WorkspaceRole || (exports.WorkspaceRole = WorkspaceRole = {}));
var SocialPlatform;
(function (SocialPlatform) {
    SocialPlatform["INSTAGRAM"] = "INSTAGRAM";
    SocialPlatform["TIKTOK"] = "TIKTOK";
    SocialPlatform["YOUTUBE"] = "YOUTUBE";
    SocialPlatform["TWITTER"] = "TWITTER";
})(SocialPlatform || (exports.SocialPlatform = SocialPlatform = {}));
var SocialProfileRole;
(function (SocialProfileRole) {
    SocialProfileRole["OWNED"] = "OWNED";
    SocialProfileRole["COMMENT_TARGET"] = "COMMENT_TARGET";
    SocialProfileRole["BENCHMARK_TARGET"] = "BENCHMARK_TARGET";
    SocialProfileRole["INSPIRATION"] = "INSPIRATION";
})(SocialProfileRole || (exports.SocialProfileRole = SocialProfileRole = {}));
var PromptOwnerType;
(function (PromptOwnerType) {
    PromptOwnerType["WORKSPACE"] = "WORKSPACE";
    PromptOwnerType["BRAND"] = "BRAND";
    PromptOwnerType["USER"] = "USER";
})(PromptOwnerType || (exports.PromptOwnerType = PromptOwnerType = {}));
var PromptType;
(function (PromptType) {
    PromptType["VOICE"] = "VOICE";
    PromptType["IDEAS_FRAMEWORK"] = "IDEAS_FRAMEWORK";
    PromptType["CONTENT_PERSONA"] = "CONTENT_PERSONA";
    PromptType["COMPOSITOR"] = "COMPOSITOR";
    PromptType["CAPTION"] = "CAPTION";
    PromptType["COMMENT_STRATEGY"] = "COMMENT_STRATEGY";
    PromptType["BENCHMARK_CHAT"] = "BENCHMARK_CHAT";
})(PromptType || (exports.PromptType = PromptType = {}));
//# sourceMappingURL=index.js.map