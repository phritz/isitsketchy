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

export function NpmSearch() {
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NpmPackageData | null>(null);

  async function analyze(target: string): Promise<void> {
    const trimmed: string = target.trim();
    if (trimmed.length === 0) {
      return;
    }
    setName(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchNpmPackage(trimmed);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch package");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="md" mt="lg">
      <Group>
        <Button
          variant="light"
          onClick={() => analyze(ANTHROPIC_SDK_PACKAGE_NAME)}
          loading={loading}
        >
          Analyze Anthropic SDK package
        </Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="npm package name"
          placeholder="express"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void analyze(name);
            }
          }}
          style={{ flex: 1 }}
        />
        <Button onClick={() => analyze(name)} loading={loading}>
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
