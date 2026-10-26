import { Alert, Box, Card, CardHeader, CircularProgress, Divider,} from "@mui/material";
import * as React from "react";
import type { SxProps, Theme } from '@mui/material/styles';


interface CardLoadingProps {
  title: string;
  titleAction?: React.ReactNode;
  children?: React.ReactNode;
  isLoading?: boolean;
  errorMsg?: string | null;
  sx?: SxProps<Theme>;
}


export function CardLoading({ title, titleAction, children, isLoading, errorMsg, sx }: CardLoadingProps): React.JSX.Element {
  return (
    <Card sx={sx}>
      <CardHeader title={title} action={titleAction}/>
      <Divider />
      {isLoading && errorMsg === null? (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center', overflowX: 'auto', minHeight:'300px' }}>
        <CircularProgress />
      </Box>
        ) : (
          errorMsg === null ? (
            <Box sx={{ p: 2 }}>{children}</Box>
          ) : (
            <Box sx={{ p: 2 }}><Alert severity="error">{errorMsg}</Alert></Box>
          )
        )}
      <Divider />
    </Card>
  );
}

