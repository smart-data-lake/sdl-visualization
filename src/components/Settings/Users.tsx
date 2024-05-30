import { Box, Select, Option, Input, Tooltip, Modal, ModalClose, ModalDialog, Typography, IconButton } from "@mui/joy";
import "ka-table/style.css";
import { dataTableStyleProps } from "../Common/DatatableStyle";
import { ActionType, DataType, ITableInstance, ITableProps, Table, useTable, useTableInstance } from "ka-table";
import { useAddUser, useFetchUsers, useRemoveUser } from "../../hooks/useFetchData";
import { useCallback, useEffect, useState, useMemo } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useQueryClient } from "react-query";
import { closeRowEditors, deleteRow, openRowEditors, saveNewRow, saveRowEditors } from "ka-table/actionCreators";
import { useTenant } from "../../hooks/TenantProvider";
import { Permission } from "./model/enums";
import { useUser } from "../../hooks/useUser";

interface ITableRendererContext {
  table: ITableInstance;
  isAdmin: boolean;
  currentUserId?: string;
}

const valueRenderer = () => {
  return (props) => <>{props.value}</>;
};

const inputRenderer = () => {
  return (props: any) => <UserEmailInput {...props} />;
};

const permissionDropdownRenderer = () => {
  return (props) => <PermissionDropdown {...props} />;
};

const editRemoveButtonsRenderer = ({ isAdmin, currentUserId }: ITableRendererContext) => {
  return (props) => (
    <>
      {currentUserId !== props.rowKeyValue && <EditButton disabled={!isAdmin} {...props} />}
      {currentUserId !== props.rowKeyValue && <RemoveButton disabled={!isAdmin} {...props} />}
    </>
  );
};

const addButtonRenderer = ({ isAdmin }: ITableRendererContext) => {
  return (props) => <AddButton disabled={!isAdmin} />;
};

const saveCancelButtonsRenderer = ({ table, isAdmin }: ITableRendererContext) => {
  return (props) => (
    <>
      <SaveButton disabled={!isAdmin} dispatch={table.dispatch} {...props} />
      <CancelButton disabled={!isAdmin} dispatch={table.dispatch} {...props} />
    </>
  );
};

const columns: any[] = [
  {
    key: "user_id",
    title: "User Id",
    dataType: DataType.String,
    editorRenderer: valueRenderer,
  },
  {
    key: "email",
    title: "User Email",
    dataType: DataType.String,
    editorRenderer: inputRenderer,
    validationFn: (props) => {
      if (!props.value) return "Value can't be empty";
    },
  },
  {
    key: "permissions",
    title: "User Permission",
    dataType: DataType.Object,
    editorRenderer: permissionDropdownRenderer,
  },
  {
    key: "actions",
    renderer: editRemoveButtonsRenderer,
    headRenderer: addButtonRenderer,
    editorRenderer: saveCancelButtonsRenderer,
  },
];

export default function Users() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const userContext = useUser();
  const { data, isFetching } = useFetchUsers();
  const { mutateAsync: addUserAsync, isLoading: isAdding, error: addUserError } = useAddUser();
  const { mutateAsync: removeUserAsync, isLoading: isRemoving } = useRemoveUser();
  const [modalOpened, setModalOpened] = useState(false);
  const isAdmin = !!userContext?.permissions?.includes(Permission.Admin);
  const currentUserId = userContext?.user_id;

  useEffect(() => {
    if (addUserError) {
      setModalOpened(true);
    }
  }, [addUserError]);

  const handleDispatch = useCallback(
    async (action: any, newState: ITableProps) => {
      const { rowKeyValue } = action;
      switch (action.type) {
        case ActionType.SaveNewRow:
        case ActionType.SaveRowEditors:
          const user = newState.data?.find((user) => user["user_id"] === rowKeyValue);
          await addUserAsync({
            email: user["email"],
            access: user["permissions"]?.[0] ?? [Permission.ReadWriter],
          });
          await queryClient.invalidateQueries(["users", tenant]);
          break;
        case ActionType.DeleteRow:
          const userEmail = data?.find((user) => user["user_id"] === rowKeyValue)["email"];
          await removeUserAsync({ email: userEmail });
          await queryClient.invalidateQueries(["users", tenant]);
          break;
      }
    },
    [data, queryClient, addUserAsync, removeUserAsync, tenant]
  );

  const table = useTable({
    onDispatch: handleDispatch,
  });

  const rendererContext = useMemo(() => {
    return { isAdmin: isAdmin, table: table, currentUserId: currentUserId } as ITableRendererContext;
  }, [isAdmin, table, currentUserId]);

  const tableColumnsRenderer = useMemo(() => {
    const renderers = {};
    columns
      .filter((c) => typeof c === "object" && c.renderer)
      .forEach((c) => (renderers[c.key] = c.renderer(rendererContext)));
    return renderers;
  }, [columns, rendererContext]);

  const tableHeadColumnsRenderer = useMemo(() => {
    const renderers = {};
    columns
      .filter((c) => typeof c === "object" && c.headRenderer)
      .forEach((c) => (renderers[c.key] = c.headRenderer(rendererContext)));
    return renderers;
  }, [columns, rendererContext]);

  const tableEditorColumnsRenderer = useMemo(() => {
    const renderers = {};
    columns
      .filter((c) => typeof c === "object" && c.editorRenderer)
      .forEach((c) => (renderers[c.key] = c.editorRenderer(rendererContext)));
    return renderers;
  }, [columns, rendererContext]);

  const tableValidationFns = useMemo(() => {
    const validationFns = {};
    columns
      .filter((c) => typeof c === "object" && c.validationFn)
      .forEach((c) => (validationFns[c.key] = c.validationFn));
    return validationFns;
  }, [columns]);

  return (
    <>
      <Box mt={1.5} sx={{ ...dataTableStyleProps, "& .ka-cell-text": { height: "auto" } }}>
        <Table
          table={table}
          columns={columns}
          rowKeyField="user_id"
          columnResizing
          data={data}
          loading={{
            enabled: isFetching || isRemoving || isAdding,
          }}
          virtualScrolling={{
            enabled: true,
          }}
          validation={(props) => {
            if (tableValidationFns && tableValidationFns[props.column.key]) {
              return tableValidationFns[props.column.key](props);
            }
          }}
          childComponents={{
            cellText: {
              content: (props) => {
                if (tableColumnsRenderer && tableColumnsRenderer[props.column.key]) {
                  return tableColumnsRenderer[props.column.key](props);
                }
              },
            },
            headCell: {
              content: (props) => {
                if (tableHeadColumnsRenderer && tableHeadColumnsRenderer[props.column.key]) {
                  return tableHeadColumnsRenderer[props.column.key](props);
                }
              },
            },
            cellEditor: {
              content: (props) => {
                if (tableEditorColumnsRenderer && tableEditorColumnsRenderer[props.column.key]) {
                  return tableEditorColumnsRenderer[props.column.key](props);
                }
              },
            },
          }}
        />
      </Box>
      <Modal open={modalOpened} onClose={() => setModalOpened(false)}>
        <ModalDialog color="danger" variant="soft">
          <ModalClose />
          <Typography level="h4" textColor="inherit" fontWeight="lg" mb={1}>
            Error
          </Typography>
          <Typography>{(addUserError as Error)?.message}</Typography>
        </ModalDialog>
      </Modal>
    </>
  );
}

const AddButton = ({ disabled }) => {
  const table = useTableInstance();
  return (
    <IconButton disabled={disabled} size="sm" onClick={() => table.showNewRow()}>
      <AddCircleOutlineOutlinedIcon />
    </IconButton>
  );
};

const SaveButton = ({ dispatch, rowKeyValue, disabled }) => {
  const table = useTableInstance();
  const isNewRow = !table.props.data?.some((user) => user["user_id"] === rowKeyValue);
  return (
    <IconButton
      size="sm"
      color="success"
      disabled={disabled}
      onClick={() =>
        dispatch(
          isNewRow
            ? saveNewRow(null, {
                validate: true,
              })
            : saveRowEditors(rowKeyValue, {
                validate: true,
              })
        )
      }
    >
      <SaveOutlinedIcon />
    </IconButton>
  );
};

const CancelButton = ({ dispatch, rowKeyValue, disabled }) => {
  const table = useTableInstance();
  const isNewRow = !table.props.data?.some((user) => user["user_id"] === rowKeyValue);
  return (
    <IconButton
      size="sm"
      color="danger"
      disabled={disabled}
      onClick={() => (isNewRow ? table.hideNewRow() : dispatch(closeRowEditors(rowKeyValue)))}
    >
      <CancelOutlinedIcon />
    </IconButton>
  );
};

const EditButton = ({ rowKeyValue, dispatch, disabled }) => {
  return (
    <IconButton size="sm" disabled={disabled} onClick={() => dispatch(openRowEditors(rowKeyValue))}>
      <EditOutlinedIcon />
    </IconButton>
  );
};

const RemoveButton = ({ rowKeyValue, dispatch, disabled }) => {
  return (
    <IconButton disabled={disabled} size="sm" onClick={() => dispatch(deleteRow(rowKeyValue))}>
      <DeleteOutlinedIcon />
    </IconButton>
  );
};

const UserEmailInput = ({ rowKeyValue, column, value, validationMessage }) => {
  const table = useTableInstance();
  const isNewRow = !table.props.data?.some((user) => user["user_id"] === rowKeyValue);
  return (
    <Tooltip
      title={validationMessage}
      variant="soft"
      color="danger"
      placement="bottom"
      arrow
      open={!!validationMessage}
    >
      <Input
        size="sm"
        autoFocus
        required
        disabled={!isNewRow}
        error={!!validationMessage}
        name="email"
        type="email"
        value={value}
        onChange={(event) => {
          table.updateEditorValue(rowKeyValue, column.key, event.target.value);
          table.validate();
        }}
      />
    </Tooltip>
  );
};

const PermissionDropdown = ({ rowKeyValue, column, value }) => {
  const table = useTableInstance();
  useEffect(() => {
    if (!value) {
      table.updateEditorValue(rowKeyValue, column.key, [Permission.ReadWriter]);
    }
  }, [value, rowKeyValue, column.key, table]);

  return (
    <Select
      size="sm"
      value={value?.[0]}
      name="access"
      required
      onChange={(_, value) => table.updateEditorValue(rowKeyValue, column.key, [value])}
    >
      <Option value={Permission.Admin}>{Permission.Admin}</Option>
      <Option value={Permission.ReadWriter}>{Permission.ReadWriter}</Option>
    </Select>
  );
};
