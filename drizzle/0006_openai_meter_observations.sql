CREATE TABLE "openai_meter_observations" (
  "attempt_id" text NOT NULL,
  "phase" text NOT NULL,
  "observation" jsonb NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "openai_meter_observations_pk" PRIMARY KEY("attempt_id","phase"),
  CONSTRAINT "openai_meter_phase" CHECK ("phase" IN ('pending','final')),
  CONSTRAINT "openai_meter_payload" CHECK (
    jsonb_typeof("observation")='object' AND
    octet_length("observation"::text) <= 16000 AND
    "observation"->'event'->>'attemptId'="attempt_id" AND
    "observation"->'event'->>'provider'='openai' AND
    (("phase"='pending' AND "observation"->>'outcome'='started') OR
     ("phase"='final' AND "observation"->>'outcome'<>'started'))
  )
);
