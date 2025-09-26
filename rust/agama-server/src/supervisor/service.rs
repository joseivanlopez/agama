// Copyright (c) [2025] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use crate::supervisor::{
    l10n, message,
    proposal::Proposal,
    scope::{ConfigScope, Scope},
    system_info::SystemInfo,
};
use agama_l10n::messages::{self, GetConfig, GetSystem, Install, SetConfig, SetSystem};
use agama_lib::install_settings::InstallSettings;
use agama_utils::actors::{self, ActorHandle};
use merge_struct::merge;
use serde::Deserialize;
use std::convert::Infallible;
use tokio::sync::{mpsc, oneshot};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    L10n(#[from] l10n::handler::Error),
    #[error("Cannot merge the configuration given")]
    CannotMergeConfig,
    #[error("The supervisor service could not send the message")]
    SendResponse,
    #[error("Actor communication error")]
    Actor(#[from] actors::ActorError),
    #[error("Infallible")]
    Infallible(#[from] Infallible),
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub enum Action {
    #[serde(rename = "configureL10n")]
    ConfigureL10n {
        language: Option<String>,
        keyboard: Option<String>,
    },
    #[serde(rename = "install")]
    Install,
}

#[derive(Debug)]
pub enum Message {
    GetSystem {
        respond_to: oneshot::Sender<SystemInfo>,
    },
    GetFullConfig {
        respond_to: oneshot::Sender<InstallSettings>,
    },
    GetFullConfigScope {
        scope: Scope,
        respond_to: oneshot::Sender<Option<ConfigScope>>,
    },
    GetConfig {
        respond_to: oneshot::Sender<InstallSettings>,
    },
    UpdateConfig {
        config: InstallSettings,
    },
    PatchConfig {
        config: InstallSettings,
    },
    GetConfigScope {
        scope: Scope,
        respond_to: oneshot::Sender<Option<ConfigScope>>,
    },
    UpdateConfigScope {
        config: ConfigScope,
    },
    PatchConfigScope {
        config: ConfigScope,
    },
    GetProposal {
        respond_to: oneshot::Sender<Option<Proposal>>,
    },
    RunAction {
        action: Action,
    },
}

/// Handler to interact with the service.
///
/// It offers a set of functions that allow interacting with the supervisor service, which runs in a
/// different Tokio task.
#[derive(Clone)]
pub struct Handler {
    sender: actors::MailboxSender,
}

impl Handler {
    pub fn new(sender: actors::MailboxSender) -> Self {
        Self { sender }
    }
}

impl actors::ActorHandle<Service> for Handler {
    type Error = Error;

    fn channel(&mut self) -> &mut actors::MailboxSender {
        &mut self.sender
    }
}

pub struct Service {
    l10n: l10n::Handler,
    user_config: InstallSettings,
    config: InstallSettings,
    proposal: Option<Proposal>,
    messages: actors::MailboxReceiver,
}

impl Service {
    pub fn new(l10n: l10n::Handler, messages: actors::MailboxReceiver) -> Self {
        Self {
            l10n,
            messages,
            config: InstallSettings::default(),
            user_config: InstallSettings::default(),
            proposal: None,
        }
    }
}

impl actors::Actor for Service {
    fn channel(&mut self) -> &mut actors::MailboxReceiver {
        &mut self.messages
    }
}

impl actors::Handles<message::GetSystem> for Service {
    type Reply = SystemInfo;
    type Error = Infallible;

    async fn handle(&mut self, _message: message::GetSystem) -> Result<Self::Reply, Self::Error> {
        let l10n_system = self
            .l10n
            .request(l10n::messages::GetSystem {})
            .await
            .unwrap();
        Ok(SystemInfo {
            localization: l10n_system,
        })
    }
}

impl actors::Handles<message::GetFullConfig> for Service {
    type Reply = InstallSettings;
    type Error = Infallible;

    async fn handle(
        &mut self,
        _message: message::GetFullConfig,
    ) -> Result<Self::Reply, Self::Error> {
        let l10n_config = self
            .l10n
            .request(l10n::messages::GetConfig {})
            .await
            .unwrap();
        Ok(InstallSettings {
            localization: Some(l10n_config),
            ..Default::default()
        })
    }
}

impl actors::Handles<message::GetFullConfigScope> for Service {
    type Reply = Option<ConfigScope>;
    type Error = Infallible;

    async fn handle(
        &mut self,
        message: message::GetFullConfigScope,
    ) -> Result<Self::Reply, Self::Error> {
        match message.scope {
            Scope::L10n => {
                let l10n_scope = self
                    .config
                    .localization
                    .clone()
                    .map(|c| ConfigScope::L10n(c));
                Ok(l10n_scope)
            }
        }
    }
}

// /// Gets the current configuration set by the user.
// ///
// /// It includes only the values that were set by the user.
// pub async fn get_config(&self) -> &InstallSettings {
//     &self.user_config
// }

// /// Patches the user configuration with the given values.
// ///
// /// It merges the current configuration with the given one.
// pub async fn patch_config(&mut self, user_config: InstallSettings) -> Result<(), Error> {
//     let config =
//         merge(&self.user_config, &user_config).map_err(|_| Error::CannotMergeConfig)?;
//     self.update_config(config).await
// }

// /// Sets the user configuration with the given values.
// ///
// /// It merges the values in the top-level. Therefore, if the configuration
// /// for a scope is not given, it keeps the previous one.
// ///
// /// FIXME: We should replace not given sections with the default ones.
// /// After all, now we have config/user/:scope URLs.
// pub async fn update_config(&mut self, user_config: InstallSettings) -> Result<(), Error> {
//     if let Some(l10n_user_config) = &user_config.localization {
//         self.l10n
//             .send(SetConfig::new(l10n_user_config.clone()))
//             .unwrap();
//         // self.l10n.set_config(l10n_user_config).await?;
//     }
//     self.user_config = user_config;
//     Ok(())
// }

// /// It returns the configuration set by the user for the given scope.
// ///
// /// * scope: scope to get the configuration for.
// pub async fn get_config_scope(&self, scope: Scope) -> Option<ConfigScope> {
//     // FIXME: implement this logic at InstallSettings level: self.get_config().by_scope(...)
//     // It would allow us to drop this method.
//     match scope {
//         Scope::L10n => self
//             .user_config
//             .localization
//             .clone()
//             .map(|c| ConfigScope::L10n(c)),
//     }
// }

// /// Patches the user configuration within the given scope.
// ///
// /// It merges the current configuration with the given one.
// pub async fn patch_config_scope(&mut self, user_config: ConfigScope) -> Result<(), Error> {
//     match user_config {
//         ConfigScope::L10n(new_config) => {
//             let base_config = self.user_config.localization.clone().unwrap_or_default();
//             let config =
//                 merge(&base_config, &new_config).map_err(|_| Error::CannotMergeConfig)?;
//             // FIXME: we are doing pattern matching twice. Is it ok?
//             // Implementing a "merge" for ScopeConfig would allow to simplify this function.
//             self.update_config_scope(ConfigScope::L10n(config)).await?;
//         }
//     }
//     Ok(())
// }

// /// Sets the user configuration within the given scope.
// ///
// /// It replaces the current configuration with the given one and calculates a
// /// new proposal. Only the configuration in the given scope is affected.
// pub async fn update_config_scope(&mut self, user_config: ConfigScope) -> Result<(), Error> {
//     match user_config {
//         ConfigScope::L10n(new_config) => {
//             // self.l10n.set_config(&new_config).await?;
//             self.l10n.send(SetConfig::new(new_config.clone())).unwrap();
//             self.user_config.localization = Some(new_config);
//         }
//     }
//     Ok(())
// }

// /// It returns the current proposal, if any.
// pub async fn get_proposal(&self) -> Option<&Proposal> {
//     self.proposal.as_ref()
// }

// pub async fn run_action(&mut self, action: Action) -> Result<(), Error> {
//     match action {
//         Action::ConfigureL10n { language, keyboard } => {
//             // self.l10n
//             //     .set_system(l10n::SystemConfig { language, keyboard })
//             //     .await?;
//             let config = l10n::SystemConfig { language, keyboard };
//             self.l10n.send(SetSystem::new(config)).unwrap();
//         }
//         Action::Install => self.l10n.send(Install {}).unwrap(),
//     }
//     Ok(())
// }
