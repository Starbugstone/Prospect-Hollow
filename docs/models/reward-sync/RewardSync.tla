---------------------------- MODULE RewardSync ----------------------------
(* Applying rewards exactly once across cloud saves, with lost replies, retries and two devices.
   See README.md for how this maps onto syncService.js and SaveService.php and what it leaves out. *)
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    Devices,
    Rewards,     \* Chests both devices can see, so both can try to claim the same one.
    MaxUploads,  \* Bound on staged uploads, so the state space is finite.
    Mutation     \* "none", or which guarantee to break on purpose. See scripts/check-models.sh.

NoPending == [id |-> 0, base |-> 0, actions |-> <<>>]

VARIABLES
    revision,    \* towns.revision.
    anchor,      \* The server's integrity baseSequence: actions up to here have been replayed.
    claimed,     \* Chests the server's profile has settled (no longer in pendingChests).
    grants,      \* Ghost: how many times the server paid out each chest.
    lastUpload,  \* towns.upload_id, making a retry of the same upload a no-op.
    local,       \* Device -> its profile and sync meta.
    earned,      \* Ghost: Device -> chests its player opened.
    nextUpload,  \* Fresh upload IDs (crypto.randomUUID).
    conflicts,   \* Ghost: a 409 has happened, to show it is reached. A flag, because lost replies repeat.
    retries      \* Ghost: a retry was answered by an upload the server already took.

vars == <<revision, anchor, claimed, grants, lastUpload, local, earned, nextUpload, conflicts, retries>>

Init ==
    /\ revision = 1
    /\ anchor = 0
    /\ claimed = {}
    /\ grants = [r \in Rewards |-> 0]
    /\ lastUpload = 0
    /\ local = [d \in Devices |->
         [claimed |-> {}, journal |-> <<>>, jbase |-> 0, base |-> 1, dirty |-> FALSE, pending |-> NoPending, recovery |-> {}]]
    /\ earned = [d \in Devices |-> {}]
    /\ nextUpload = 1
    /\ conflicts = FALSE
    /\ retries = FALSE

ActionsAfter(journal, seq) == {journal[i] : i \in {k \in DOMAIN journal : journal[k].seq > seq}}
RewardsIn(journal) == {journal[i].r : i \in DOMAIN journal}
NextSeq(l) == l.jbase + Len(l.journal) + 1

(* campaignStore: a claim needs the chest still pending, and appends its receipt to the journal. *)
Earn(d, r) ==
    /\ r \notin local[d].claimed
    /\ local' = [local EXCEPT
         ![d].claimed = @ \cup {r},
         ![d].journal = Append(@, [seq |-> NextSeq(local[d]), r |-> r]),
         ![d].dirty = TRUE]
    /\ earned' = [earned EXCEPT ![d] = @ \cup {r}]
    /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, nextUpload, conflicts, retries>>

(* syncTown then stage: a durable pending upload, only once the device's base matches the cloud. *)
Stage(d) ==
    /\ local[d].pending = NoPending
    /\ local[d].dirty
    /\ local[d].base = revision
    /\ nextUpload <= MaxUploads
    /\ local' = [local EXCEPT
         ![d].pending = [id |-> nextUpload, base |-> local[d].base, actions |-> local[d].journal]]
    /\ nextUpload' = nextUpload + 1
    /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, earned, conflicts, retries>>

(* conflict(): the cloud copy wins, anything unsent goes to the recovery copy first. *)
Adopt(l, keepCopy) ==
    [l EXCEPT
        !.claimed = claimed,
        !.journal = <<>>,
        !.jbase = anchor,
        !.base = revision,
        !.dirty = FALSE,
        !.pending = NoPending,
        !.recovery = IF keepCopy /\ Mutation # "conflict_loses_progress"
                     THEN @ \cup RewardsIn(l.journal) \cup RewardsIn(l.pending.actions)
                     ELSE @]

(* accept(): acknowledge the uploaded prefix. Later actions stay in the journal and stay dirty. *)
Acknowledged(l, ack, rev) ==
    LET kept == [i \in 1..Len(l.journal) - Cardinality({k \in DOMAIN l.journal : l.journal[k].seq <= ack}) |->
                   l.journal[i + Cardinality({k \in DOMAIN l.journal : l.journal[k].seq <= ack})]]
    IN [l EXCEPT
        !.journal = kept,
        !.jbase = IF ack > @ THEN ack ELSE @,
        !.base = rev,
        !.pending = NoPending,
        !.dirty = Len(kept) > 0]

(* The game's in-memory journal can lag an acknowledgment until mergeIntegrity catches it up, so a later
   upload may repeat receipts the server already replayed. The server must not pay for them twice. *)
AcknowledgedLagging(l, rev) ==
    [l EXCEPT !.base = rev, !.pending = NoPending, !.dirty = TRUE]

(* Reply lost: the server did the work and the device still holds the same pending upload to retry. *)
Answer(d, arrives, answer) == IF arrives THEN answer ELSE local

(* PUT towns/{id}, handled atomically as SaveService::transact is, with a reply that may never arrive. *)
Upload(d, arrives, trims) ==
    LET p == local[d].pending
        IsRetry == p.id = lastUpload
        Stale == p.base # revision /\ Mutation # "server_ignores_revision"
        replayable == IF Mutation \in {"replay_everything", "no_anchor_check"}
                      THEN {p.actions[i] : i \in DOMAIN p.actions}
                      ELSE ActionsAfter(p.actions, anchor)
        new == {a.r : a \in replayable} \
               (IF Mutation \in {"replay_everything", "no_entitlement_check"} THEN {} ELSE claimed)
        topSeq == IF Len(p.actions) = 0 THEN anchor
                  ELSE IF p.actions[Len(p.actions)].seq > anchor THEN p.actions[Len(p.actions)].seq ELSE anchor
    IN  /\ p # NoPending
        /\ IF IsRetry THEN
               /\ retries' = TRUE
               /\ local' = Answer(d, arrives, [local EXCEPT ![d] = IF trims THEN Acknowledged(@, anchor, revision) ELSE AcknowledgedLagging(@, revision)])
               /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, conflicts>>
           ELSE IF Stale THEN
               /\ conflicts' = TRUE
               /\ local' = Answer(d, arrives, [local EXCEPT ![d] = Adopt(@, @.dirty)])
               /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, retries>>
           ELSE
               /\ revision' = revision + 1
               /\ anchor' = topSeq
               /\ claimed' = claimed \cup new
               /\ grants' = [r \in Rewards |-> grants[r] + IF r \in new THEN 1 ELSE 0]
               /\ lastUpload' = p.id
               /\ local' = Answer(d, arrives, [local EXCEPT ![d] = IF trims THEN Acknowledged(@, topSeq, revision + 1) ELSE AcknowledgedLagging(@, revision + 1)])
               /\ UNCHANGED <<conflicts, retries>>
        /\ UNCHANGED <<earned, nextUpload>>

(* syncTown's GET: a newer cloud save replaces the device's copy, keeping unsent progress as a recovery copy. *)
Pull(d) ==
    /\ local[d].pending = NoPending
    /\ local[d].base # revision
    /\ local' = [local EXCEPT ![d] = Adopt(@, @.dirty)]
    /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, earned, nextUpload, conflicts, retries>>

(* Only with the mutation: the device treats an upload as acknowledged without hearing back. *)
AssumeAcknowledged(d) ==
    /\ Mutation = "ack_without_reply"
    /\ local[d].pending # NoPending
    /\ local' = [local EXCEPT ![d] = Acknowledged(@, @.jbase + Len(@.journal), @.base)]
    /\ UNCHANGED <<revision, anchor, claimed, grants, lastUpload, earned, nextUpload, conflicts, retries>>

(* Everything synced and nothing left to earn is a correct end, not a deadlock. *)
Settled ==
    /\ \A d \in Devices : local[d].pending = NoPending /\ ~local[d].dirty /\ local[d].base = revision
    /\ UNCHANGED vars

Next ==
    \/ \E d \in Devices, r \in Rewards : Earn(d, r)
    \/ \E d \in Devices : Stage(d) \/ Pull(d) \/ AssumeAcknowledged(d)
    \/ \E d \in Devices, arrives, trims \in BOOLEAN : Upload(d, arrives, trims)
    \/ Settled
    \/ (nextUpload > MaxUploads /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
\* The server pays out each chest at most once, whatever retries and devices do.
AtMostOnce == \A r \in Rewards : grants[r] <= 1

\* A chest the server has settled was paid out exactly once.
SettledMeansPaid == \A r \in Rewards : (r \in claimed) <=> (grants[r] = 1)

\* A chest a player opened is on the server, still on its way, or kept in that device's recovery copy: never silently gone.
NothingSilentlyLost ==
    \A d \in Devices : \A r \in earned[d] :
        \/ r \in claimed
        \/ r \in RewardsIn(local[d].journal)
        \/ r \in RewardsIn(local[d].pending.actions)
        \/ r \in local[d].recovery

\* A device never believes more has been acknowledged than the server has replayed.
AckNeverAhead == \A d \in Devices : local[d].jbase <= anchor

\* Journals stay contiguous, so a replay can never skip a receipt.
JournalsContiguous ==
    \A d \in Devices : \A i \in DOMAIN local[d].journal : local[d].journal[i].seq = local[d].jbase + i

\* The server's revision counts the uploads it accepted, so a retry never advances it.
RevisionsCountUploads == revision <= nextUpload

\* Each of these must fail, as proof the checked runs include the risky cases.
NeverConflicts == ~conflicts
NeverRetriesAcceptedUpload == ~retries
NeverBothClaimOneChest == \A r \in Rewards : Cardinality({d \in Devices : r \in earned[d]}) <= 1
=============================================================================
