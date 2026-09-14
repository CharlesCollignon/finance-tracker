-- Two more wrappers: assurance-vie and the PER.
--
-- The wallet enum has been `pea | cto | crypto` since 008, which covered the
-- accounts one person happened to hold. It is not the shape of French
-- long-term saving: an assurance-vie is where most of it sits, and a PER is
-- where the tax deduction is. A portfolio the app cannot see is a portfolio
-- the app cannot weigh, and the look-through is about to start weighing.
--
-- `add value` rather than a new text column with a check constraint. The enum
-- is referenced by three tables and read by name in half a dozen modules;
-- converting it would touch every one of them to buy a flexibility nobody has
-- asked for. Enum values cannot be dropped, which is the real cost here — but
-- these two are statutory wrappers, not a taxonomy anyone will want to revise.
--
-- `if not exists` so re-running this file is harmless. Postgres allows adding
-- a value inside a transaction but refuses to let the same transaction use it,
-- which is why nothing below mentions 'av' or 'per': the code that reads them
-- lands in the migrations after this one.

alter type investment_wallet add value if not exists 'av';
alter type investment_wallet add value if not exists 'per';
