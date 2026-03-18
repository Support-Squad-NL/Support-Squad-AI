# Assistant Status Mapping

This document defines how `statusSummary` is derived for `GET /assistants/:assistantId`.

## Source fields

- `assistant.status`
- `assistant.instance.id`
- `assistant.instance.ip`
- `assistant.instance.status`
- `assistant.webhook.readiness`

## Summary values

- `failed`
  - When `assistant.status === "failed"`.

- `ready`
  - When `assistant.status === "ready"` and `assistant.webhook.readiness === "ready"`.

- `deprovisioning`
  - When `assistant.status === "deprovision_requested"`.

- `provisioning`
  - Default when provisioning has started but specific progress details are not yet available.
  - Also used when no instance exists yet.

- `waiting_for_ip`
  - When an instance id exists, but public IP is not known yet.

- `bootstrapping`
  - When an IP exists and instance status is `provisioning` or `installing`.
  - Also used when `assistant.status === "bootstrapping"`.

## UI guidance

- Treat `ready` as the only state where Chatwoot should start sending traffic.
- Show a spinner/progress indication for `provisioning`, `waiting_for_ip`, `bootstrapping`, and `deprovisioning`.
- Show retry/support actions for `failed`.
