import { useState } from "react";
import {
  Modal,
  Stack,
  Divider,
  Paper,
  Group,
  Box,
  Text,
  Badge,
  Alert,
  Button,
  Center,
  Loader,
  Title,
  Menu,
  ActionIcon,
  TextInput,
} from "@mantine/core";
import {
  IconUser,
  IconPhone,
  IconClock,
  IconEdit,
  IconBan,
  IconCheck,
  IconDotsVertical,
  IconHanger,
  IconCalendarEvent,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import {
  useDetailedClient,
  useAddClientToBlacklist,
  useRemoveClientFromBlacklist,
  useDeleteClient,
} from "../../hooks/useClients";
import {
  formatPhoneNumber,
  formatStayDates,
  ORDER_STATUS_MAP,
} from "src/utills/formatters";
import { ClientUpdateForm } from "../clients/clientUpdateForm";
import { ChildUpdateForm } from "../children/ChildUpdateForm";
import { ChildCreateForm } from "../children/ChildCreateForm";
import { useDeleteChild, useUpdateChild } from "../../hooks/useChild";
import { ConfirmDeleteModal } from "src/components/ConfirmDeleteModal";

interface ClientDetailedModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: number | null;
}

export function ClientDetailedModal({
  opened,
  onClose,
  clientId,
}: ClientDetailedModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState("");

  const [isChildCreateModalOpen, setIsChildCreateModalOpen] = useState(false);
  const [childToEdit, setChildToEdit] = useState<{
    childId: number;
    name: string;
  } | null>(null);
  const [childToDelete, setChildToDelete] = useState<{
    childId: number;
    name: string;
  } | null>(null);

  const { data, isLoading, isError } = useDetailedClient(clientId!);
  const addBlacklistMutation = useAddClientToBlacklist();
  const removeBlacklistMutation = useRemoveClientFromBlacklist();
  const deleteMutation = useDeleteClient();

  const updateChildMutation = useUpdateChild();
  const deleteChildMutation = useDeleteChild();

  const handleClose = () => {
    setIsEditing(false);
    setIsBlacklistModalOpen(false);
    setIsDeleteModalOpen(false);
    setBlacklistReason("");
    setIsChildCreateModalOpen(false);
    setChildToEdit(null);
    setChildToDelete(null);
    onClose();
  };

  const handleAddBlacklist = () => {
    if (!clientId) return;
    addBlacklistMutation.mutate(
      { clientId, data: { blacklistReason } },
      {
        onSuccess: () => {
          setIsBlacklistModalOpen(false);
          setBlacklistReason("");
        },
      },
    );
    onClose();
  };

  const handleRemoveBlacklist = () => {
    if (!clientId) return;
    removeBlacklistMutation.mutate(clientId);
  };

  const formatKZTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteClient = () => {
    if (!clientId) return;
    deleteMutation.mutate(clientId, {
      onSuccess: () => {
        handleClose();
      },
    });
  };

  const handleDeleteChild = () => {
    if (!childToDelete || !clientId) return;
    deleteChildMutation.mutate(
      { childId: childToDelete.childId, clientId },
      {
        onSuccess: () => setChildToDelete(null),
      },
    );
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        size="lg"
        title={
          <Group gap="xs">
            <IconUser size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={700}>Карточка клиента</Text>
          </Group>
        }
      >
        {isLoading && (
          <Center p="xl">
            <Loader />
          </Center>
        )}

        {isError && (
          <Alert color="red" title="Ошибка">
            Не удалось загрузить данные клиента.
          </Alert>
        )}

        {data?.client && (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              {isEditing ? (
                <Box style={{ flexGrow: 1 }}>
                  <ClientUpdateForm
                    client={{
                      ...data.client,
                      id: String(data.client.clientId),
                    }}
                    onSuccess={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                  />
                </Box>
              ) : (
                <>
                  <Box>
                    <Group gap="sm" align="center" mb={4}>
                      <Title order={3} style={{ wordBreak: "break-word" }}>
                        {data.client.name}
                      </Title>
                      {data.client.isBlacklisted && (
                        <Badge color="red" variant="filled">
                          В черном списке
                        </Badge>
                      )}
                    </Group>
                    <Group gap={4} c="dimmed">
                      <IconPhone size={16} />
                      <Text size="md">
                        {formatPhoneNumber(data.client.phone)}
                      </Text>
                    </Group>
                  </Box>

                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="lg">
                        <IconDotsVertical size={20} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={16} />}
                        onClick={() => setIsEditing(true)}
                      >
                        Редактировать
                      </Menu.Item>
                      <Menu.Divider />
                      {data.client.isBlacklisted ? (
                        <Menu.Item
                          color="green"
                          leftSection={<IconCheck size={16} />}
                          onClick={handleRemoveBlacklist}
                        >
                          Убрать из ЧС
                        </Menu.Item>
                      ) : (
                        <Menu.Item
                          color="red"
                          leftSection={<IconBan size={16} />}
                          onClick={() => setIsBlacklistModalOpen(true)}
                        >
                          Добавить в ЧС
                        </Menu.Item>
                      )}

                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={() => setIsDeleteModalOpen(true)}
                      >
                        Удалить клиента
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </>
              )}
            </Group>

            {data.client.isBlacklisted && data.client.blacklistReason && (
              <Alert
                color="red"
                variant="light"
                title="Причина блокировки:"
                icon={<IconBan size={18} />}
              >
                {data.client.blacklistReason}
              </Alert>
            )}

            {!isEditing && (
              <Box>
                <Group justify="space-between" align="center" mb="sm">
                  <Text size="md" fw={600} c="dimmed">
                    Дети:
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => setIsChildCreateModalOpen(true)}
                  >
                    Добавить ребенка
                  </Button>
                </Group>

                {data.client.children && data.client.children.length > 0 ? (
                  <Stack gap="xs">
                    {data.client.children.map((child) => (
                      <Paper
                        key={child.childId}
                        withBorder
                        p="xs"
                        radius="md"
                        bg="gray.0"
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Text fw={500} size="sm">
                            {child.name}
                          </Text>
                          <Group gap={4}>
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => setChildToEdit(child)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setChildToDelete(child)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" fs="italic">
                    Дети не добавлены
                  </Text>
                )}
              </Box>
            )}

            <Divider label="История визитов" labelPosition="center" />

            {data.visits.length > 0 ? (
              data.visits.map((visit) => (
                <Paper
                  key={visit.visitId}
                  withBorder
                  p="md"
                  radius="md"
                  bg="gray.0"
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Badge variant="light" size="lg">
                        Визит #{visit.visitCode}
                      </Badge>
                      <Group gap={4} c="dimmed">
                        <IconCalendarEvent size={14} />
                        <Text size="sm">{formatKZTime(visit.createdAt)}</Text>
                      </Group>
                    </Group>

                    <Stack gap="sm" mt="xs">
                      {visit.orders.map((order) => (
                        <Box
                          key={order.orderId}
                          p="xs"
                          bg="white"
                          style={{
                            borderRadius: "8px",
                            border: "1px solid var(--mantine-color-gray-3)",
                            borderLeft: "4px solid var(--mantine-color-blue-6)",
                          }}
                        >
                          <Group justify="space-between" mb={4}>
                            <Group gap={6}>
                              <IconHanger
                                size={16}
                                color="var(--mantine-color-blue-6)"
                              />
                              <Text size="md" fw={600}>
                                {order.costumeName} ({order.inventoryCode})
                              </Text>
                            </Group>
                            <Badge
                              size="md"
                              variant="dot"
                              color={
                                ORDER_STATUS_MAP[order.orderStatus]?.color ||
                                "gray"
                              }
                            >
                              {ORDER_STATUS_MAP[order.orderStatus]?.label ||
                                order.orderStatus}
                            </Badge>
                          </Group>

                          <Group gap={6} mb={8}>
                            <Text size="md" c="dimmed">
                              Ребенок:
                            </Text>
                            <Text size="md" fw={500}>
                              {order.childName}
                            </Text>
                          </Group>

                          <Group justify="space-between">
                            <Group gap={4} c="gray.7">
                              <IconClock size={14} />
                              <Text size="xs" fw={500}>
                                {formatStayDates(
                                  visit.startDateTime,
                                  visit.endDateTime,
                                )}
                              </Text>
                            </Group>
                            <Text size="xs" fw={700}>
                              {order.rentPrice} ₸ (Пред.{" "}
                              {order.prepaymentAmount} ₸)
                            </Text>
                          </Group>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Alert color="gray" variant="light" ta="center">
                История визитов пуста
              </Alert>
            )}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={isBlacklistModalOpen}
        onClose={() => setIsBlacklistModalOpen(false)}
        title={<Text fw={700}>Добавление в черный список</Text>}
        centered
        zIndex={300}
      >
        <TextInput
          label="Причина (необязательно)"
          placeholder="Например: Порвали костюм и нагрубили"
          value={blacklistReason}
          onChange={(e) => setBlacklistReason(e.currentTarget.value)}
          data-autofocus
          mb="lg"
        />
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => setIsBlacklistModalOpen(false)}
          >
            Отмена
          </Button>
          <Button
            color="red"
            onClick={handleAddBlacklist}
            loading={addBlacklistMutation.isPending}
          >
            В черный список
          </Button>
        </Group>
      </Modal>

      <ConfirmDeleteModal
        opened={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Удаление клиента"
        itemName={`клиента ${data?.client.name}`}
        onDelete={handleDeleteClient}
        isDeleting={deleteMutation.isPending}
      />

      <Modal
        opened={isChildCreateModalOpen}
        onClose={() => setIsChildCreateModalOpen(false)}
        title={<Text fw={700}>Добавить ребенка</Text>}
        centered
        zIndex={300}
      >
        <ChildCreateForm
          clientId={clientId!}
          onCreated={() => setIsChildCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        opened={!!childToEdit}
        onClose={() => setChildToEdit(null)}
        title={<Text fw={700}>Редактировать ребенка</Text>}
        centered
        zIndex={300}
      >
        {childToEdit && (
          <ChildUpdateForm
            child={childToEdit}
            onClose={() => setChildToEdit(null)}
            isLoading={updateChildMutation.isPending}
            onSave={(newName) =>
              updateChildMutation.mutate(
                {
                  childId: childToEdit.childId,
                  clientId: clientId!,
                  name: newName,
                },
                { onSuccess: () => setChildToEdit(null) },
              )
            }
          />
        )}
      </Modal>

      <ConfirmDeleteModal
        opened={!!childToDelete}
        onClose={() => setChildToDelete(null)}
        title="Удаление ребенка"
        itemName={`ребенка ${childToDelete?.name}`}
        onDelete={handleDeleteChild}
        isDeleting={deleteChildMutation.isPending}
      />
    </>
  );
}
