# Phase F — Live Classroom Broadcasting (6-Digit Code & QR Join)

## Scope and product goal

Phase F brings real-time interactive classroom broadcasting to FlowCanvas (`com.teachingboard.aitricker` Live Class parity), allowing a teacher to broadcast their board live to students' devices via a **6-digit numeric code or scannable QR code** with **zero student account creation required**.

1. **Host Live Class Flow (`Start Live Class`)** — generates a 6-digit classroom code and QR code, streams real-time canvas operations, laser trails, page switches, and timer state to connected students.
2. **Zero-Account Student Join Flow (`Join Live Class` on Home)** — students enter the 6-digit code (or scan QR) and their display name to watch the live board in real time on their phone or tablet.
3. **Classroom Moderation & Interactive Student Boards** — Raise Hand queue (`👋`), Teacher "Pass the Marker" (granting temporary write access to a student), Lock Class toggle, and Student Work Gallery where the teacher can inspect or showcase a student's scratchpad to the class.

## 1. Realtime Classroom Architecture (`src/classroom/classroom-session.ts`)

### Do we need a custom backend server? (Transport evaluation)

To connect a teacher's device with 1–50 student devices across Wi-Fi or mobile data via a 6-digit room code, we evaluated three architectures:

| Option | How it works | Custom server code needed? | Why chosen / trade-offs |
|---|---|---|---|
| **1. Managed Realtime Pub/Sub (`Supabase Realtime Broadcast + Presence`)** | Teacher and students subscribe to WebSocket channel `classroom:<6-digit-code>` using a public anon key. Teacher broadcasts JSON commands and ephemeral stroke/laser packets; Presence tracks the student roster & raised hands. | **Zero custom server required** (no Node/Go backend to deploy or maintain; fits `docs/architecture.md`). | **Chosen primary cloud transport.** Low latency (~30–60 ms), works across NAT/firewalls/cellular without STUN/TURN headaches, scales to full classrooms, and costs $0 on the free tier for ephemeral broadcast messages. |
| **2. Direct Peer-to-Peer (`WebRTC DataChannels` + signaling)** | Teacher opens direct P2P data/audio connections to each student after a signaling handshake. | Needs a signaling server + STUN/TURN relay servers when school Wi-Fi blocks P2P UDP. | Great for 1-on-1 tutoring voice/video, but in a 30-student classroom the teacher's phone must encode/upload 30 separate P2P streams (high battery/CPU drain) and school firewalls often block UDP without paid TURN relays. |
| **3. Custom WebSocket / gRPC Server (Node.js / Socket.io / Go)** | Self-hosted stateful room server holding room codes and forwarding packets. | Yes (Docker, hosting, TLS, scaling, health checks). | Unnecessary operational overhead when Supabase Realtime Broadcast already provides WebSocket rooms and Presence out of the box. |

### Transport adapter & offline-first boundary
- Designed around a clean `ClassroomTransport` interface (`src/classroom/transport.ts`) so the app is never locked to a single provider:
  - **`SupabaseRealtimeTransport`:** uses Supabase Realtime Broadcast & Presence channels (`classroom:<code>`) over WebSockets when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are configured. No database tables or student accounts are required for live ephemeral broadcast!
  - **`LocalLoopbackTransport` / `BroadcastChannelTransport`:** in-memory / local multi-peer transport for offline demos, split-screen/simulator testing, and automated Node verification (`scripts/verify-live-classroom.mts`) without requiring live cloud credentials.
- Local SQLite board persistence remains the source of truth for the teacher's board: ending or disconnecting from a Live Class never loses a single stroke on the teacher's device.

### Room code & QR payload
```ts
export type ClassroomRole = 'teacher' | 'student';

export type StudentPermission = 'view-only' | 'can-draw' | 'locked';

export type ClassroomParticipant = {
  peerId: string;
  displayName: string;
  role: ClassroomRole;
  permission: StudentPermission;
  handRaised: boolean;
  joinedAt: string;
};

export type ClassroomRoomInfo = {
  roomCode: string; // 6-digit numeric string, e.g. "482910"
  boardId: string;
  boardTitle: string;
  hostPeerId: string;
  deepLinkUri: string; // e.g. "flowcanvas://join?code=482910"
  isLocked: boolean;
};
```

## 2. Real-Time Sync Protocol (`src/classroom/protocol.ts`)

Messages broadcast over the classroom channel are compact, schema-validated envelopes:
1. `snapshot.sync`: sent when a student joins or changes page, carrying the current `BoardPageRecord` (`document`, `viewport`, `BoardSettings`) so late joiners immediately see the full board.
2. `command.broadcast`: streams every committed `HistoryCommand` (`stroke.add`, `strokes.erase`, `object.create`, `object.update`, `object.delete`, `batch`) with monotonic `seq` numbers.
3. `ephemeral.stream`: throttled (`30 Hz`) stream of active in-progress ink points, `laser` pointer trails, Geometry Box instrument movements, and teacher viewport camera position (`followTeacherViewport`).
4. `classroom.control`:
   - `hand.raise` / `hand.lower` from student;
   - `permission.grant` / `permission.revoke` (`Pass the Marker` to a specific `peerId`);
   - `class.lock` / `class.unlock` (freezes student scratchpads and blocks new joins when locked);
   - `student.showcase` (broadcasts a selected student's board snapshot to the class).
5. `student.board.update`: periodic thumbnail/summary digest from each student's local scratchpad so the teacher can view the **Student Boards Gallery**.

## 3. UI Surfaces (`src/components/LiveClassHostSheet.tsx`, `src/components/JoinClassModal.tsx`, `src/components/ClassroomHud.tsx`)

### Teacher surfaces
- **Live Class Host Sheet (`LiveClassHostSheet.tsx`):**
  - Displays the large formatted 6-digit code (`482 - 910`) with `Copy code`, `Share link`, and an SVG QR code rendered via `react-native-svg`.
  - Live participant roster showing connected student count, raised-hand badges (`👋`), per-student `Allow to draw` toggle, `Showcase work`, and `Remove`.
  - Global `Lock class` switch and `End live class` button.
- **Compact Classroom HUD (`ClassroomHud.tsx`):**
  - Floating top pill showing `LIVE • 18 students`, a badge counter for raised hands, and one-tap access to the roster or `Student Boards Gallery`.

### Student surfaces
- **`Join Live Class` button on Home (`app/index.tsx`):**
  - Opens `JoinClassModal.tsx` where the student enters the 6-digit code and their name (no sign-up or password).
- **Student Live Editor mode:**
  - By default follows the teacher's board in `View-only` mode with a `👋 Raise Hand` button and a toggle to switch to the student's own `My Scratchpad` copy of the page.
  - When the teacher grants `can-draw` permission, a toast banner announces `"Teacher passed you the marker"` and unlocks the inking dock on the shared board.

## Verification (`scripts/verify-live-classroom.mts`)

Add `npm run test:live-classroom` covering:
- 6-digit room code generation, validation, and `flowcanvas://join?code=...` deep-link parsing.
- Multi-peer session simulation using `LocalLoopbackTransport` (1 teacher + 3 students):
  - initial `snapshot.sync` on student join;
  - real-time propagation of teacher ink strokes, shape creation, laser pointer, timer state, and page switches;
  - security/permission enforcement: rejecting `command.broadcast` messages from `view-only` students, accepting them when `permission === 'can-draw'`, and revoking immediately when locked;
  - Raise Hand queue ordering, teacher acknowledge/lower, and Student Board showcase broadcast;
  - clean disconnect and reconnect resynchronization via `seq` checkpoint.
