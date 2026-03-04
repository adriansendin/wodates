# Translation batches (ES/EN)

## Batch 1: Entry screens — DONE

**Scope:** index (landing), auth (login), register (steps 1–6).

**Status:** All UI text in these screens uses `useTranslation('common')` and `t('...')`.  
`en/common.json` and `es/common.json` have the same keys (170 total) and cover Batch 1.

**Files (no changes needed):**
- `app/index.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/register/step1.tsx` … `step6.tsx`
- `app/(auth)/_layout.tsx`, `app/(auth)/register/_layout.tsx` (no UI strings)

**Keys used (summary):** `app.*`, `auth.*`, `register.*`, `common.continue`, `common.back`, `profile.gender*`, `profile.lookingFor*`, `errors.*` (for messages).

**How to test (web):**
1. `npm run start:web` (or `npx expo start --web`).
2. Open app in browser; set browser language to Spanish (e.g. Spanish first in Chrome languages).
3. Check: Home (index) shows Spanish (tagline, buttons, caption).
4. Go to Sign in: labels, placeholders and button in Spanish.
5. Go to Create account → complete register flow (step1 → step6): all titles, options (gender, looking for, children, smoking), buttons (Continue, Back) and error/success messages in Spanish.
6. Switch browser language to English and reload; repeat; all same screens should be in English.

---

## Batch 2: Onboarding / profile edit — DONE

**Scope:** Profile edit screen, BirthDatePicker, modals (gender, looking for, family, habits, contact, delete account).

**Files touched:**
- `app/(app)/profile.tsx` — all section titles, labels, modal titles, "Cancel", "Edit", contact/delete modals, loading/session messages.
- `src/components/BirthDatePicker.tsx` — Day/Month/Year labels (`birthDate.day/month/year`), future date error (`register.futureDateError`).

**Keys added:** `profile.selectGenderTitle`, `profile.sectionBasicInfo`, `profile.labelName`, `profile.labelCity`, `profile.labelBirthDate`, `profile.labelGender`, `profile.labelLookingFor`, `profile.labelPreferredAgeRange`, `profile.sectionFamilyPlans`, `profile.labelHasChildren`, `profile.labelWantsChildren`, `profile.labelCarePartnerChildren`, `profile.sectionHabits`, `profile.labelSmoking`, `profile.labelCarePartnerSmoking`, `profile.sectionBio`, `profile.bioBasedOnConversations`, `profile.showProfileToOthers`, `profile.autoSaveMessage`, `profile.readManifesto`, `profile.contactUs`, `profile.loadingProfile`, `profile.sessionInvalid`, `profile.contactModalTitle`, `profile.characterCount`, `profile.messageMinLength`, `profile.messageSentSuccess`, `profile.deleteAccountTitle`, `profile.deleteAccountBody`, `profile.edit`; `birthDate.day`, `birthDate.month`, `birthDate.year`.

---

## Batch 3: Settings + errors / toasts / modals — DONE

**Scope:** notifySystem/toast messages, BioPopupModal, AffinityModal, feed pass error, chat errors, profile verify/photos.

**Files touched:**
- `src/utils/notificationService.ts` — use passed title/message for system errors instead of overwriting with English.
- `app/(app)/feed.tsx` — notifySystem on pass error uses `t('errors.somethingWentWrong')`, `t('errors.tryAgain')`.
- `src/components/BioPopupModal.tsx` — "No bio available" → `t('feed.noBioAvailable')`.
- `src/components/AffinityModal.tsx` — "Based on conversations" → `t('feed.basedOnConversations')`, "No affinity information available" → `t('feed.noAffinityAvailable')`.
- `app/chat/[matchId].tsx` — added `useTranslation('common')`; all notifySystem and setError use `t('errors.*')` (invalidMessages, loadOlderMessages, networkError, somethingWentWrong, tryAgain); Alert.alert for send error uses t().
- `app/profile/verify.tsx` — notifySystem and Alert (selfie received) use t().
- `app/profile/photos.tsx` — all notifySystem use t().

**Keys added:** `feed.noAffinityAvailable`; `errors.invalidMessages`, `errors.loadOlderMessages`; `profile.selfieReceivedTitle`, `profile.selfieReceivedBody`.

---

## Conventions

- Single namespace: `common`.
- Key groups: `auth.*`, `onboarding.*` or `register.*`/`profile.*`, `settings.*`, `errors.*`, `common.*`, `modals.*`, `feed.*`, `matches.*`.
- Interpolations: `t('key', { name })` etc.
- Do not translate: logs, route paths, event names, API/DB field names, internal constants.
