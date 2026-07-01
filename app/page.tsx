import { Container, Title, Text } from "@mantine/core";

export default function Home() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Is It Sketchy?</Title>
      <Text mt="md">Hello world.</Text>
    </Container>
  );
}
