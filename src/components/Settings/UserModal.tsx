import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Select,
  Stack,
  Typography,
  Option,
} from "@mui/joy";
import { Permission } from "./model/enums";
import { useAddUser } from "../../hooks/useFetchData";
import { useQueryClient } from "react-query";

export default function UserModal({ open, onClose }) {
  const addUserMutation = useAddUser();
  const queryClient = useQueryClient();

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ width: 400 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          User Assignment
        </Typography>
        <form
          onSubmit={async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const formJson = Object.fromEntries((formData as any).entries());
            await addUserMutation.mutateAsync({
              tenant: "PrivateTenant",
              ...formJson,
            });
            queryClient.invalidateQueries(["users", "PrivateTenant"]);
            onClose();
          }}
        >
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input autoFocus required name="email" type="email" />
            </FormControl>
            <FormControl>
              <FormLabel>Permission</FormLabel>
              <Select
                defaultValue={Permission.ReadWriter}
                name="access"
                required
              >
                <Option value={Permission.Admin}>{Permission.Admin}</Option>
                <Option value={Permission.ReadWriter}>
                  {Permission.ReadWriter}
                </Option>
              </Select>
            </FormControl>
            <Button type="submit">Save</Button>
          </Stack>
        </form>
      </ModalDialog>
    </Modal>
  );
}
