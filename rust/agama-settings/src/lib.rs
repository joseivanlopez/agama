pub mod error;
pub mod settings;

pub use self::error::SettingsError;
pub use self::settings::{SettingObject, SettingValue};
pub use agama_derive::Settings;