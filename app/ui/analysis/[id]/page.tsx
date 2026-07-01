"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Anchor,
  Badge,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  getAnalysis,
  type AnalysisRunData,
  type AnalysisSubjectData,
  type ResultStatus,
  type RiskScore,
} from "@/app/api/analysis/client";

const POLL_INTERVAL_MS: number = 1500;

function statusColor(status: ResultStatus): string {
  switch (status) {
    case "completed":
      return "green";
    case "running":
      return "blue";
    case "failed":
      return "red";
    case "pending":
    default:
      return "gray";
  }
}

function riskColor(risk: RiskScore): string {
  switch (risk) {
    case "green":
      return "green";
    case "yellow":
      return "yellow";
    case "red":
    default:
      return "red";
  }
}

function isTerminal(status: ResultStatus): boolean {
  return status === "completed" || status === "failed";
}

function SubjectSection({ subject }: { subject: AnalysisSubjectData }) {
  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Badge variant="light" color={subject.type === "repo" ? "grape" : "cyan"}>
          {subject.type}
        </Badge>
        <Text fw={600}>{subject.name}</Text>
        <Badge color={statusColor(subject.status)}>{subject.status}</Badge>
      </Group>

      {subject.repoUrl ? (
        <Text size="sm" c="dimmed">
          repo: {subject.repoUrl}
        </Text>
      ) : null}

      {subject.error ? (
        <Text size="sm" c="red">
          {subject.error.code}: {subject.error.message}
        </Text>
      ) : null}

      {subject.results.length === 0 ? (
        <Text size="sm" c="dimmed">
          No signals yet.
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Signal</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Risk</Table.Th>
              <Table.Th>Comment</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {subject.results.map((result) => (
              <Table.Tr key={result.id}>
                <Table.Td>{result.name}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor(result.status)}>
                    {result.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {result.riskScore ? (
                    <Badge color={riskColor(result.riskScore)}>
                      {result.riskScore}
                    </Badge>
                  ) : (
                    <Text c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>{result.comment ?? ""}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const id: string = params.id;
  const [run, setRun] = useState<AnalysisRunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active: boolean = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll(): Promise<void> {
      try {
        const data = await getAnalysis(id);
        if (!active) {
          return;
        }
        setRun(data);
        if (!isTerminal(data.status)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load analysis");
        }
      }
    }

    void poll();
    return () => {
      active = false;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [id]);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>Analysis</Title>
          <Anchor href="/ui/analysis">All analyses</Anchor>
        </Group>

        {error ? <Text c="red">{error}</Text> : null}

        {run === null ? (
          <Text c="dimmed">Loading…</Text>
        ) : (
          <Stack gap="xl">
            <Stack gap="xs">
              <Group gap="xs" align="center">
                <Text fw={600}>{run.repoUrl}</Text>
                <Badge color={statusColor(run.status)}>{run.status}</Badge>
              </Group>
              {run.error ? (
                <Text c="red">
                  {run.error.code}: {run.error.message}
                </Text>
              ) : null}
            </Stack>

            {run.subjects.length === 0 && run.error === null ? (
              <Text c="dimmed">Discovering subjects…</Text>
            ) : (
              run.subjects.map((subject) => (
                <SubjectSection key={subject.id} subject={subject} />
              ))
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
