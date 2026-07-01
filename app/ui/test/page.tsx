"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Container,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { createRepo, listRepos, type Repo } from "@/app/api/repos/client";

export default function TestPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const rows = await listRepos();
      setRepos(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repos");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onAdd(): Promise<void> {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createRepo({ url: trimmed });
      setUrl("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add repo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1}>Repos test</Title>

        <Group align="flex-end">
          <TextInput
            label="Repo URL"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={onAdd} loading={loading}>
            Add
          </Button>
        </Group>

        {error ? <Text c="red">{error}</Text> : null}

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>URL</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {repos.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text c="dimmed">No repos yet.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              repos.map((repo) => (
                <Table.Tr key={repo.id}>
                  <Table.Td>{repo.url}</Table.Td>
                  <Table.Td>{new Date(repo.createdAt).toLocaleString()}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Container>
  );
}
