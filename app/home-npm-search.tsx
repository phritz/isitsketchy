"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { createPackageAnalysis } from "@/app/api/analysis/client";

const ANTHROPIC_SDK_PACKAGE_NAME: string = "@anthropic-ai/sdk";

type PendingSource = "anthropic" | "input";

export function NpmSearch() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(target: string, source: PendingSource): Promise<void> {
    const trimmed: string = target.trim();
    if (trimmed.length === 0) {
      return;
    }
    setName(trimmed);
    setPending(source);
    setError(null);
    try {
      const { id } = await createPackageAnalysis(trimmed);
      router.push(`/ui/analysis/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setPending(null);
    }
  }

  return (
    <Stack gap="md" mt="lg">
      <Group>
        <Button
          variant="light"
          onClick={() => analyze(ANTHROPIC_SDK_PACKAGE_NAME, "anthropic")}
          loading={pending === "anthropic"}
          disabled={pending !== null && pending !== "anthropic"}
        >
          Analyze Anthropic SDK package
        </Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="Analyze an npm package by name"
          placeholder="express"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void analyze(name, "input");
            }
          }}
          style={{ flex: 1 }}
        />
        <Button
          onClick={() => analyze(name, "input")}
          loading={pending === "input"}
          disabled={pending !== null && pending !== "input"}
        >
          Analyze
        </Button>
      </Group>

      {error ? <Text c="red">{error}</Text> : null}
    </Stack>
  );
}
