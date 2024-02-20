import { Box, Button } from "@mui/joy";
import "ka-table/style.css";
import { dataTableStyleProps } from "../Common/DatatableStyle";
import { DataType, Table } from "ka-table";
import { Column } from "ka-table/models";
import { useFetchUsers } from "../../hooks/useFetchData";
import UserModal from "./UserModal";
import { useState } from "react";

const columns: Column[] = [
  {
    key: "user_id",
    title: "User Id",
    dataType: DataType.String,
  },
  {
    key: "email",
    title: "User Email",
    dataType: DataType.String,
  },
  {
    key: "permissions",
    title: "User Permission",
    dataType: DataType.Object,
  },
];

export default function Users() {
  const { data } = useFetchUsers();
  const [modalOpened, setModalOpened] = useState(false);

  return (
    <Box mt={1.5} sx={dataTableStyleProps}>
      <Button sx={{ mb: 1 }} onClick={() => setModalOpened(true)}>
        Add user
      </Button>
      <Table
        columns={columns}
        rowKeyField="user_id"
        columnResizing
        data={data}
        virtualScrolling={{
          enabled: true,
        }}
      />
      <UserModal open={modalOpened} onClose={() => setModalOpened(false)} />
    </Box>
  );
}
