import { Anchor, Container, Text, Title } from "@mantine/core";

export default function Home() {
  return (
    <Container size="sm" py="xl">
      <Title order={1}>Is It Sketchy?</Title>
      <Text mt="md">Hello world.</Text>
      <Anchor href="/ui/test" mt="md" display="block">
        Test page
      </Anchor>
    </Container>
  );
}
