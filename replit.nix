{ pkgs }: {
  deps = [
    pkgs.python310
    pkgs.python310Packages.pip
    pkgs.nodejs_20
    pkgs.nodePackages.npm
  ];
}
