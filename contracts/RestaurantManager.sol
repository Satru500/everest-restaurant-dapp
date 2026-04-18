// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  RestaurantManager
 * @notice Smart contract for Everest Restaurant — manages menu, orders,
 *         tables, and reservations on the Ethereum blockchain.
 * @dev    CN6035 Mobile & Distributed Systems — DApp Assignment
 *         University of East London, 2025/26
 */
contract RestaurantManager {

    // ── State variables ──────────────────────────────────────
    address public owner;
    uint256 public menuItemCount;
    uint256 public orderCount;
    uint256 public tableCount;
    uint256 public reservationCount;

    // ── Structs ──────────────────────────────────────────────

    struct MenuItem {
        uint256 id;
        string  name;
        string  description;
        uint256 price;       // in wei
        string  category;
        bool    isAvailable;
        uint256 createdAt;
    }

    struct Order {
        uint256   id;
        address   customer;
        uint256[] itemIds;
        uint256[] quantities;
        uint256   totalAmount;
        OrderStatus status;
        uint256   tableNumber;
        uint256   createdAt;
        uint256   updatedAt;
    }

    struct Table {
        uint256     id;
        uint256     capacity;
        TableStatus status;
        address     currentCustomer;
    }

    struct Reservation {
        uint256           id;
        address           customer;
        uint256           tableId;
        uint256           partySize;
        uint256           reservationTime;
        ReservationStatus status;
        string            customerName;
        string            contactInfo;
    }

    // ── Enums ────────────────────────────────────────────────

    enum OrderStatus       { Pending, Confirmed, Preparing, Ready, Delivered, Cancelled }
    enum TableStatus       { Available, Occupied, Reserved, Maintenance }
    enum ReservationStatus { Pending, Confirmed, Cancelled, Completed }

    // ── Mappings ─────────────────────────────────────────────

    mapping(uint256 => MenuItem)    public menuItems;
    mapping(uint256 => Order)       public orders;
    mapping(uint256 => Table)       public tables;
    mapping(uint256 => Reservation) public reservations;
    mapping(address => uint256[])   public customerOrders;
    mapping(address => uint256[])   public customerReservations;
    mapping(address => bool)        public isStaff;

    // ── Events ───────────────────────────────────────────────

    event MenuItemAdded(uint256 indexed id, string name, uint256 price, string category);
    event MenuItemUpdated(uint256 indexed id, string name, uint256 price, bool isAvailable);
    event OrderPlaced(uint256 indexed orderId, address indexed customer, uint256 totalAmount, uint256 tableNumber);
    event OrderStatusUpdated(uint256 indexed orderId, OrderStatus newStatus);
    event TableAdded(uint256 indexed tableId, uint256 capacity);
    event TableStatusUpdated(uint256 indexed tableId, TableStatus newStatus);
    event ReservationMade(uint256 indexed reservationId, address indexed customer, uint256 tableId, uint256 reservationTime);
    event ReservationStatusUpdated(uint256 indexed reservationId, ReservationStatus newStatus);
    event PaymentReceived(uint256 indexed orderId, address indexed customer, uint256 amount);
    event StaffAdded(address indexed staffMember);
    event StaffRemoved(address indexed staffMember);

    // ── Modifiers ────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyStaffOrOwner() {
        require(msg.sender == owner || isStaff[msg.sender], "Only staff or owner");
        _;
    }

    modifier menuItemExists(uint256 _id) {
        require(_id > 0 && _id <= menuItemCount, "Menu item not found");
        _;
    }

    modifier orderExists(uint256 _id) {
        require(_id > 0 && _id <= orderCount, "Order not found");
        _;
    }

    modifier tableExists(uint256 _id) {
        require(_id > 0 && _id <= tableCount, "Table not found");
        _;
    }

    // ── Constructor ──────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        isStaff[msg.sender] = true;

        // Seed tables
        _addTable(4);
        _addTable(2);
        _addTable(6);
        _addTable(4);
        _addTable(8);

        // Seed menu — Everest Restaurant
        _addMenuItem("Dal Bhat",           "Traditional lentil soup with steamed rice and seasonal vegetables", 0.008 ether, "Main");
        _addMenuItem("Momo (Steamed)",     "Handmade dumplings filled with spiced chicken, served with tomato achar", 0.010 ether, "Starter");
        _addMenuItem("Momo (Fried)",       "Crispy fried dumplings filled with vegetables or chicken", 0.012 ether, "Starter");
        _addMenuItem("Thakali Set",        "Full Nepalese set meal with rice, lentils, curry, pickle and greens", 0.015 ether, "Main");
        _addMenuItem("Butter Chicken",     "Tender chicken in a rich tomato and butter sauce, served with naan", 0.014 ether, "Main");
        _addMenuItem("Lamb Curry",         "Slow-cooked lamb with Himalayan spices and basmati rice", 0.018 ether, "Main");
        _addMenuItem("Vegetable Biryani",  "Aromatic basmati rice with mixed vegetables and fried onions", 0.012 ether, "Main");
        _addMenuItem("Samosa (2 pcs)",     "Crispy pastry filled with spiced potatoes and peas", 0.006 ether, "Starter");
        _addMenuItem("Mango Lassi",        "Chilled yoghurt drink blended with fresh mango", 0.004 ether, "Drinks");
        _addMenuItem("Masala Chai",        "Spiced Nepalese tea brewed with ginger, cardamom and milk", 0.003 ether, "Drinks");
        _addMenuItem("Gulab Jamun",        "Soft milk-solid dumplings soaked in rose-flavoured sugar syrup", 0.006 ether, "Dessert");
        _addMenuItem("Kheer",             "Creamy rice pudding with cardamom, saffron and pistachios", 0.005 ether, "Dessert");
    }

    // ── Menu management ──────────────────────────────────────

    function _addMenuItem(
        string memory _name,
        string memory _description,
        uint256 _price,
        string memory _category
    ) internal {
        menuItemCount++;
        menuItems[menuItemCount] = MenuItem({
            id:          menuItemCount,
            name:        _name,
            description: _description,
            price:       _price,
            category:    _category,
            isAvailable: true,
            createdAt:   block.timestamp
        });
        emit MenuItemAdded(menuItemCount, _name, _price, _category);
    }

    function addMenuItem(
        string memory _name,
        string memory _description,
        uint256 _price,
        string memory _category
    ) external onlyStaffOrOwner {
        require(bytes(_name).length > 0, "Name required");
        require(_price > 0, "Price must be greater than 0");
        _addMenuItem(_name, _description, _price, _category);
    }

    function updateMenuItem(
        uint256 _itemId,
        string memory _name,
        uint256 _price,
        bool _isAvailable
    ) external onlyStaffOrOwner menuItemExists(_itemId) {
        MenuItem storage item = menuItems[_itemId];
        item.name        = _name;
        item.price       = _price;
        item.isAvailable = _isAvailable;
        emit MenuItemUpdated(_itemId, _name, _price, _isAvailable);
    }

    function toggleMenuItemAvailability(uint256 _itemId)
        external onlyStaffOrOwner menuItemExists(_itemId)
    {
        menuItems[_itemId].isAvailable = !menuItems[_itemId].isAvailable;
    }

    function getMenuItem(uint256 _itemId)
        external view menuItemExists(_itemId)
        returns (MenuItem memory)
    {
        return menuItems[_itemId];
    }

    function getAllMenuItems() external view returns (MenuItem[] memory) {
        MenuItem[] memory items = new MenuItem[](menuItemCount);
        for (uint256 i = 1; i <= menuItemCount; i++) {
            items[i - 1] = menuItems[i];
        }
        return items;
    }

    // ── Order management ─────────────────────────────────────

    function placeOrder(
        uint256[] memory _itemIds,
        uint256[] memory _quantities,
        uint256 _tableNumber
    ) external payable {
        require(_itemIds.length > 0, "Order must have at least one item");
        require(_itemIds.length == _quantities.length, "Items and quantities mismatch");
        require(_tableNumber > 0 && _tableNumber <= tableCount, "Invalid table number");

        uint256 total = 0;
        for (uint256 i = 0; i < _itemIds.length; i++) {
            require(_itemIds[i] > 0 && _itemIds[i] <= menuItemCount, "Invalid menu item");
            require(menuItems[_itemIds[i]].isAvailable, "Item not available");
            require(_quantities[i] > 0, "Quantity must be greater than 0");
            total += menuItems[_itemIds[i]].price * _quantities[i];
        }

        require(msg.value >= total, "Insufficient payment");

        orderCount++;
        orders[orderCount] = Order({
            id:          orderCount,
            customer:    msg.sender,
            itemIds:     _itemIds,
            quantities:  _quantities,
            totalAmount: total,
            status:      OrderStatus.Pending,
            tableNumber: _tableNumber,
            createdAt:   block.timestamp,
            updatedAt:   block.timestamp
        });

        customerOrders[msg.sender].push(orderCount);
        tables[_tableNumber].status          = TableStatus.Occupied;
        tables[_tableNumber].currentCustomer = msg.sender;

        // Refund any overpayment
        if (msg.value > total) {
            payable(msg.sender).transfer(msg.value - total);
        }

        emit OrderPlaced(orderCount, msg.sender, total, _tableNumber);
        emit PaymentReceived(orderCount, msg.sender, total);
    }

    function updateOrderStatus(uint256 _orderId, OrderStatus _newStatus)
        external onlyStaffOrOwner orderExists(_orderId)
    {
        Order storage o = orders[_orderId];
        require(o.status != OrderStatus.Cancelled, "Cannot update cancelled order");
        require(o.status != OrderStatus.Delivered,  "Order already delivered");
        o.status    = _newStatus;
        o.updatedAt = block.timestamp;
        if (_newStatus == OrderStatus.Delivered) {
            tables[o.tableNumber].status          = TableStatus.Available;
            tables[o.tableNumber].currentCustomer = address(0);
        }
        emit OrderStatusUpdated(_orderId, _newStatus);
    }

    function getOrder(uint256 _orderId)
        external view orderExists(_orderId)
        returns (Order memory)
    {
        return orders[_orderId];
    }

    function getAllOrders() external view returns (Order[] memory) {
        Order[] memory all = new Order[](orderCount);
        for (uint256 i = 1; i <= orderCount; i++) {
            all[i - 1] = orders[i];
        }
        return all;
    }

    function calculateOrderTotal(
        uint256[] memory _itemIds,
        uint256[] memory _quantities
    ) external view returns (uint256 total) {
        for (uint256 i = 0; i < _itemIds.length; i++) {
            if (_itemIds[i] > 0 && _itemIds[i] <= menuItemCount) {
                total += menuItems[_itemIds[i]].price * _quantities[i];
            }
        }
    }

    // ── Table management ─────────────────────────────────────

    function _addTable(uint256 _capacity) internal {
        tableCount++;
        tables[tableCount] = Table({
            id:              tableCount,
            capacity:        _capacity,
            status:          TableStatus.Available,
            currentCustomer: address(0)
        });
        emit TableAdded(tableCount, _capacity);
    }

    function addTable(uint256 _capacity) external onlyStaffOrOwner {
        require(_capacity > 0, "Capacity must be greater than 0");
        _addTable(_capacity);
    }

    function updateTableStatus(uint256 _tableId, TableStatus _newStatus)
        external onlyStaffOrOwner tableExists(_tableId)
    {
        tables[_tableId].status = _newStatus;
        if (_newStatus == TableStatus.Available) {
            tables[_tableId].currentCustomer = address(0);
        }
        emit TableStatusUpdated(_tableId, _newStatus);
    }

    function getAllTables() external view returns (Table[] memory) {
        Table[] memory all = new Table[](tableCount);
        for (uint256 i = 1; i <= tableCount; i++) {
            all[i - 1] = tables[i];
        }
        return all;
    }

    function getAvailableTables() external view returns (Table[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= tableCount; i++) {
            if (tables[i].status == TableStatus.Available) count++;
        }
        Table[] memory available = new Table[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= tableCount; i++) {
            if (tables[i].status == TableStatus.Available) {
                available[idx++] = tables[i];
            }
        }
        return available;
    }

    // ── Reservation management ───────────────────────────────

    function makeReservation(
        uint256 _tableId,
        uint256 _partySize,
        uint256 _reservationTime,
        string  memory _customerName,
        string  memory _contactInfo
    ) external tableExists(_tableId) {
        require(_partySize > 0, "Party size must be greater than 0");
        require(_reservationTime > block.timestamp, "Reservation time must be in the future");
        require(_partySize <= tables[_tableId].capacity, "Party size exceeds table capacity");
        require(bytes(_customerName).length > 0, "Customer name required");

        reservationCount++;
        reservations[reservationCount] = Reservation({
            id:              reservationCount,
            customer:        msg.sender,
            tableId:         _tableId,
            partySize:       _partySize,
            reservationTime: _reservationTime,
            status:          ReservationStatus.Pending,
            customerName:    _customerName,
            contactInfo:     _contactInfo
        });

        customerReservations[msg.sender].push(reservationCount);
        tables[_tableId].status = TableStatus.Reserved;

        emit ReservationMade(reservationCount, msg.sender, _tableId, _reservationTime);
    }

    function updateReservationStatus(uint256 _reservationId, ReservationStatus _newStatus)
        external onlyStaffOrOwner
    {
        require(_reservationId > 0 && _reservationId <= reservationCount, "Reservation not found");
        reservations[_reservationId].status = _newStatus;
        if (_newStatus == ReservationStatus.Cancelled || _newStatus == ReservationStatus.Completed) {
            tables[reservations[_reservationId].tableId].status = TableStatus.Available;
        }
        emit ReservationStatusUpdated(_reservationId, _newStatus);
    }

    function getAllReservations() external view returns (Reservation[] memory) {
        Reservation[] memory all = new Reservation[](reservationCount);
        for (uint256 i = 1; i <= reservationCount; i++) {
            all[i - 1] = reservations[i];
        }
        return all;
    }

    // ── Staff management ─────────────────────────────────────

    function addStaff(address _member) external onlyOwner {
        require(_member != address(0), "Invalid address");
        isStaff[_member] = true;
        emit StaffAdded(_member);
    }

    function removeStaff(address _member) external onlyOwner {
        require(_member != owner, "Cannot remove owner");
        isStaff[_member] = false;
        emit StaffRemoved(_member);
    }

    // ── Finance ──────────────────────────────────────────────

    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner).transfer(balance);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ── Stats ────────────────────────────────────────────────

    function getRestaurantStats() external view returns (
        uint256 totalMenuItems,
        uint256 totalOrders,
        uint256 totalTables,
        uint256 totalReservations,
        uint256 contractBalance
    ) {
        return (menuItemCount, orderCount, tableCount, reservationCount, address(this).balance);
    }

    receive() external payable {}
}
