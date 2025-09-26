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
use agama_utils::actors::{self, Actor, ActorHandler, Handler};
use async_trait::async_trait;
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

pub struct Service<T: l10n::ModelAdapter> {
    l10n: l10n::Handler<T>,
    user_config: InstallSettings,
    config: InstallSettings,
    proposal: Option<Proposal>,
}

impl<T: l10n::ModelAdapter> Service<T> {
    pub fn new(l10n: l10n::Handler<T>) -> Self {
        Self {
            l10n,
            config: InstallSettings::default(),
            user_config: InstallSettings::default(),
            proposal: None,
        }
    }
}

impl<T: l10n::ModelAdapter> Actor for Service<T> {
    type Error = Error;
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::GetSystem> for Service<T> {
    /// It returns the information of the underlying system.
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let l10n_system = self.l10n.call(l10n::messages::GetSystem {}).await.unwrap();
        Ok(SystemInfo {
            localization: l10n_system,
        })
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::GetFullConfig> for Service<T> {
    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    async fn handle(&mut self, _message: message::GetFullConfig) -> Result<InstallSettings, Error> {
        let l10n_config = self.l10n.call(l10n::messages::GetConfig {}).await.unwrap();
        Ok(InstallSettings {
            localization: Some(l10n_config),
            ..Default::default()
        })
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::GetFullConfigScope> for Service<T> {
    /// It returns the configuration for the given scope.
    async fn handle(
        &mut self,
        message: message::GetFullConfigScope,
    ) -> Result<Option<ConfigScope>, Error> {
        let option = match message.scope {
            Scope::L10n => {
                let l10n_config = self.l10n.call(l10n::messages::GetConfig {}).await.unwrap();
                Some(ConfigScope::L10n(l10n_config))
            }
        };
        Ok(option)
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::GetConfig> for Service<T> {
    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    async fn handle(&mut self, _message: message::GetConfig) -> Result<InstallSettings, Error> {
        Ok(self.user_config.clone())
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::SetConfig> for Service<T> {
    /// Sets the user configuration with the given values.
    ///
    /// It merges the values in the top-level. Therefore, if the configuration
    /// for a scope is not given, it keeps the previous one.
    ///
    /// FIXME: We should replace not given sections with the default ones.
    /// After all, now we have config/user/:scope URLs.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        if let Some(l10n_config) = &message.config.localization {
            self.l10n
                .call(l10n::messages::SetConfig::new(l10n_config.clone()))
                .await
                .unwrap();
        }
        self.user_config = message.config;
        Ok(())
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::UpdateConfig> for Service<T> {
    /// Patches the user configuration with the given values.
    ///
    /// It merges the current configuration with the given one.
    async fn handle(&mut self, message: message::UpdateConfig) -> Result<(), Error> {
        let config =
            merge(&self.user_config, &message.config).map_err(|_| Error::CannotMergeConfig)?;
        self.handle(message::SetConfig::new(config)).await
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::GetConfigScope> for Service<T> {
    /// It returns the configuration set by the user for the given scope.
    async fn handle(
        &mut self,
        message: message::GetConfigScope,
    ) -> Result<Option<ConfigScope>, Error> {
        // FIXME: implement this logic at InstallSettings level: self.get_config().by_scope(...)
        // It would allow us to drop this method.
        let option = match message.scope {
            Scope::L10n => self
                .user_config
                .localization
                .clone()
                .map(|c| ConfigScope::L10n(c)),
        };
        Ok(option)
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::SetConfigScope> for Service<T> {
    /// Sets the user configuration within the given scope.
    ///
    /// It replaces the current configuration with the given one and calculates a
    /// new proposal. Only the configuration in the given scope is affected.
    async fn handle(&mut self, message: message::SetConfigScope) -> Result<(), Error> {
        match message.config {
            ConfigScope::L10n(l10n_config) => {
                self.l10n
                    .call(SetConfig::new(l10n_config.clone()))
                    .await
                    .unwrap();
                self.user_config.localization = Some(l10n_config);
            }
        }
        Ok(())
    }
}

#[async_trait]
impl<T: l10n::ModelAdapter> Handler<message::UpdateConfigScope> for Service<T> {
    /// Patches the user configuration within the given scope.
    ///
    /// It merges the current configuration with the given one.
    async fn handle(&mut self, message: message::UpdateConfigScope) -> Result<(), Error> {
        match message.config {
            ConfigScope::L10n(l10n_config) => {
                let base_config = self.user_config.localization.clone().unwrap_or_default();
                let config =
                    merge(&base_config, &l10n_config).map_err(|_| Error::CannotMergeConfig)?;
                self.handle(message::SetConfigScope::new(ConfigScope::L10n(config)))
                    .await
                    .unwrap();
            }
        }
        Ok(())
    }
}

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
