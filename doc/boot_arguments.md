# Reading arguments from kernel command line

D-Installer configuration can be altered through the kernel command line. It is possible to load a
full configuration file or to change some specific values.

## Loading a new configuration file

It is possible to load a new configuration file specifying a URL through the `dinst.config_url`
option. Here are some examples:

* `dinst.config_url=http://192.168.122.1/my-d-installer.yaml`
* `dinst.config_url=usb:///d-installer.yaml`

See [URL handling in the
installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) to find more details
about the supported URLs.

## Changing configuration values

Instead of loading a full configuration file, you might be interested in adjusting just a few
configuration values. You must specify the option name in dotted notation. A typical use-case might
be to use your own SSL certificates:

```
dinst.web.ssl=true dinst.web.ssl_cert=http://192.168.122.1/mycert.pem dinst.web.ssl_key=http://192.168.122.1/mycert.key
```

Changing complex options (e.g., collections) is not supported yet.