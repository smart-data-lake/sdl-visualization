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
import { Permission } from "./model/enums";
import { useUser } from "../../hooks/useUser";
import IconButtonWithTooltip from "../Common/IconButtonWithTooltip";
import { NO_PERMISSION_ACTION_BUTTON } from "../../util/constants/message.constant";
import { useWorkspace } from "../../hooks/useWorkspace";

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
    width: 140
  },
  {
    key: "actions",
    renderer: editRemoveButtonsRenderer,
    headRenderer: addButtonRenderer,
    editorRenderer: saveCancelButtonsRenderer,
    width: 55
  },
];

export default function Users() {
  const queryClient = useQueryClient();
  const { tenant } = useWorkspace();
  const userContext = useUser();
  const { data, isFetching } = useFetchUsers(userContext?.authenticated || false);
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
            enabled: isFetching
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
    <IconButtonWithTooltip
      icon={AddCircleOutlineOutlinedIcon}
      disabled={disabled}
      onClick={() => table.showNewRow()}
      showTooltip={disabled}
      size="sm"
      tooltipMessage={NO_PERMISSION_ACTION_BUTTON}
    />
  );
};

const SaveButton = ({ dispatch, rowKeyValue, disabled }) => {
  const table = useTableInstance();
  const isNewRow = !table.props.data?.some((user) => user["user_id"] === rowKeyValue);
  return (
    <IconButtonWithTooltip
      icon={SaveOutlinedIcon}
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
      showTooltip={disabled}
      size="sm"
      color="success"
      tooltipMessage={NO_PERMISSION_ACTION_BUTTON}
    />
  );
};

const CancelButton = ({ dispatch, rowKeyValue, disabled }) => {
  const table = useTableInstance();
  const isNewRow = !table.props.data?.some((user) => user["user_id"] === rowKeyValue);
  return (
    <IconButtonWithTooltip
      icon={CancelOutlinedIcon}
      disabled={disabled}
      onClick={() => (isNewRow ? table.hideNewRow() : dispatch(closeRowEditors(rowKeyValue)))}
      showTooltip={disabled}
      size="sm"
      color="danger"
      tooltipMessage={NO_PERMISSION_ACTION_BUTTON}
    />
  );
};

const EditButton = ({ rowKeyValue, dispatch, disabled }) => {
  return (
    <IconButtonWithTooltip
      icon={EditOutlinedIcon}
      disabled={disabled}
      onClick={() => dispatch(openRowEditors(rowKeyValue))}
      showTooltip={disabled}
      size="sm"
      tooltipMessage={NO_PERMISSION_ACTION_BUTTON}
    />
  );
};

const RemoveButton = ({ rowKeyValue, dispatch, disabled }) => {
  return (
    <IconButtonWithTooltip
      icon={DeleteOutlinedIcon}
      disabled={disabled}
      onClick={() => dispatch(deleteRow(rowKeyValue))}
      showTooltip={disabled}
      size="sm"
      tooltipMessage={NO_PERMISSION_ACTION_BUTTON}
    />
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
