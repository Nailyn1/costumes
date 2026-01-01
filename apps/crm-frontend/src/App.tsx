import "./App.css";
import { Button, Card, Image, Text, Badge, Group } from "@mantine/core";

function CostumeCard() {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder w={300} m="xl">
      <Card.Section>
        <Image
          src="../src/assets/react.svg"
          height={160}
          alt="Spider-man costume"
        />
      </Card.Section>

      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500}>Костюм Человека-Паука</Text>
        <Badge color="pink">New</Badge>
      </Group>

      <Text size="sm" c="dimmed">
        Идеальный костюм для детского праздника. Легкий, дышащий и очень
        реалистичный.
      </Text>

      <Button color="blue" fullWidth mt="md" radius="md">
        Забронировать сейчас
      </Button>
    </Card>
  );
}
export default CostumeCard;
