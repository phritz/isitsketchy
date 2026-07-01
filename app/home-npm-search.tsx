"use client";

import { useState } from "react";
import {
  Button,
  Code,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  fetchNpmPackage,
  type NpmPackageData,
} from "@/app/api/sources/npm/client";

const ANTHROPIC_SDK_PACKAGE_NAME: string = "@anthropic-ai/sdk";

type PendingSource = "anthropic" | "input";

export function NpmSearch() {
  const [name, setName] = useState<string>("");
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NpmPackageData | null>(null);

  async function analyze(target: string, source: PendingSource): Promise<void> {
    const trimmed: string = target.trim();
    if (trimmed.length === 0) {
      return;
    }
    setName(trimmed);
    setPending(source);
    setError(null);
    setResult(null);
    try {
      const data = await fetchNpmPackage(trimmed);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch package");
    } finally {
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

      {result ? (
        <Stack gap="xs">
          <Text fw={600}>{result.packument.name}</Text>
          <Code block>{JSON.stringify(result, null, 2)}</Code>
        </Stack>
      ) : null}
    </Stack>
  );
}
