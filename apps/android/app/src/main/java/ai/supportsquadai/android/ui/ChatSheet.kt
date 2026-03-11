package ai.supportsquadai.android.ui

import androidx.compose.runtime.Composable
import ai.supportsquadai.android.MainViewModel
import ai.supportsquadai.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
