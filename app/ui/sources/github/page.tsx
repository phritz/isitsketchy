"use client";

import { useState } from "react";
import {
  Anchor,
  Button,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  clearGithubRepos,
  deleteGithubRepo,
  listGithubRepos,
  type GithubRepoSummary,
} from "@/app/api/sources/github/client";
import { useAsyncData } from "@/lib/use-async-data";

export default function GithubCachePage() {
  const {
    data,
    error,
    reload,
    setError,
  } = useAsyncData<GithubRepoSummary[]>(listGithubRepos, "Failed to load cache");
  const rows: GithubRepoSummary[] = data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState<boolean>(false);

  async function onRemove(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await deleteGithubRepo(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove entry");
    } finally {
      setBusyId(null);
    }
  }

  async function onClearAll(): Promise<void> {
    setClearing(true);
    setError(null);
    try {
      await clearGithubRepos();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear cache");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Anchor href="/ui">← Home</Anchor>
        <Title order={1}>GitHub cache</Title>

        <Group justify="space-between" align="center">
          <Text c="dimmed">
            {rows.length} cached {rows.length === 1 ? "repo" : "repos"}
          </Text>
          <Button
            color="red"
            variant="light"
            onClick={onClearAll}
            loading={clearing}
            disabled={rows.length === 0}
          >
            Clear all
          </Button>
        </Group>

        {error ? <Text c="red">{error}</Text> : null}

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>URL</Table.Th>
              <Table.Th>Fetched</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed">No cached repos yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.url}</Table.Td>
                  <Table.Td>
                    {new Date(row.fetchedAt).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => onRemove(row.id)}
                      loading={busyId === row.id}
                    >
                      Remove
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Container>
  );
}
