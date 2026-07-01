"use client";

import {
  Alert,
  Anchor,
  Container,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";

type SignalRow = {
  name: string;
  green: string;
  yellow: string;
  red: string;
};

const REPO_SIGNAL_ROWS: SignalRow[] = [
  {
    name: "Last push recency",
    green: "<= 1 month",
    yellow: "1-6 months",
    red: "> 6 months",
  },
  {
    name: "Repo age",
    green: ">= 12 months",
    yellow: "3-12 months",
    red: "< 3 months",
  },
  {
    name: "GitHub stars",
    green: ">= 500",
    yellow: "50-499",
    red: "< 50",
  },
  {
    name: "Archived / disabled",
    green: "active",
    yellow: "archived",
    red: "disabled",
  },
  {
    name: "License present",
    green: "any license present",
    yellow: "—",
    red: "no license",
  },
  {
    name: "Contributor count",
    green: ">= 10",
    yellow: "2-9",
    red: "0-1",
  },
  {
    name: "Recent commit volume",
    green: ">= 5 in 6 months",
    yellow: "1-4",
    red: "0",
  },
  {
    name: "Issue responsiveness",
    green: "closed:open >= 2 (or 0 open)",
    yellow: "0.5-2",
    red: "< 0.5",
  },
];

const PACKAGE_SIGNAL_ROWS: SignalRow[] = [
  {
    name: "npm package age",
    green: ">= 12 months",
    yellow: "3-12 months",
    red: "< 3 months",
  },
  {
    name: "Latest publish recency",
    green: "<= 6 months",
    yellow: "6-18 months",
    red: "> 18 months",
  },
  {
    name: "Maintainer count",
    green: ">= 2",
    yellow: "1",
    red: "0",
  },
  {
    name: "Install hooks",
    green: "none",
    yellow: "—",
    red: "any preinstall/install/postinstall",
  },
  {
    name: "Monthly downloads",
    green: ">= 100,000",
    yellow: "1,000-99,999",
    red: "< 1,000",
  },
  {
    name: "Transparent build",
    green: "provenance present",
    yellow: "registry-signed only",
    red: "unsigned",
  },
  {
    name: "Deprecation",
    green: "latest not deprecated",
    yellow: "—",
    red: "latest deprecated",
  },
  {
    name: "Incoming dependents",
    green: ">= 100",
    yellow: "10-99",
    red: "< 10",
  },
];

function SignalTable({ rows }: { rows: SignalRow[] }) {
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Signal</Table.Th>
          <Table.Th>Green</Table.Th>
          <Table.Th>Yellow</Table.Th>
          <Table.Th>Red</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.name}>
            <Table.Td>{row.name}</Table.Td>
            <Table.Td>{row.green}</Table.Td>
            <Table.Td>{row.yellow}</Table.Td>
            <Table.Td>{row.red}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export default function SignalsPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Anchor href="/ui">← Home</Anchor>

        <Title order={1}>Signals</Title>

        <Text>
          These are the trustworthiness signals we evaluate. Each signal is
          scored green, yellow, or red based on the thresholds below. Repo
          signals are computed from GitHub metadata; package signals are
          computed from npm metadata.
        </Text>

        <Alert color="blue" variant="light" title="About these parameters">
          The thresholds below are hardcoded today. They could easily be made
          web-configurable so they can be tuned without a code change.
        </Alert>

        <Stack gap="xs">
          <Title order={2}>Repo signals</Title>
          <SignalTable rows={REPO_SIGNAL_ROWS} />
        </Stack>

        <Stack gap="xs">
          <Title order={2}>Package signals</Title>
          <SignalTable rows={PACKAGE_SIGNAL_ROWS} />
        </Stack>
      </Stack>
    </Container>
  );
}
