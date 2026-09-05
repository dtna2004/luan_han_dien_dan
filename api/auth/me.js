const { getUserFromRequest } = require('../../lib/auth');

module.exports = async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(200).json({ user: null });
    return;
  }
  res.status(200).json({
    user: {
      username: user.username,
      display_name: user.display_name || user.username,
      role: user.role,
    },
  });
};
